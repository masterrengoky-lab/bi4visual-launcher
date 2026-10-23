//! Modrinth: search for mods and modpacks, install mods with their required
//! dependencies, and turn a `.mrpack` modpack into a new instance.

use crate::download::{self, get_json, Job};
use crate::instances::{self, InstalledMod, Instance, Loader};
use crate::paths::Paths;
use crate::{Progress, ProgressFn};
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::Read;

const API: &str = "https://api.modrinth.com/v2";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProjectType {
    Mod,
    Modpack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hit {
    pub project_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub author: String,
    #[serde(default)]
    pub categories: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub hits: Vec<Hit>,
    pub total_hits: u64,
}

fn enc(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Builds the search URL. Facets are AND-ed groups of OR-ed values.
pub fn search_url(query: &str, kind: ProjectType, game: Option<&str>, loader: Option<&str>, offset: u32) -> String {
    let mut facets = vec![format!(r#"["project_type:{}"]"#, if kind == ProjectType::Mod { "mod" } else { "modpack" })];
    if let Some(g) = game {
        facets.push(format!(r#"["versions:{g}"]"#));
    }
    if let Some(l) = loader {
        facets.push(format!(r#"["categories:{l}"]"#));
    }
    let facets = format!("[{}]", facets.join(","));
    format!(
        "{API}/search?query={}&facets={}&index=relevance&limit=20&offset={offset}",
        enc(query),
        enc(&facets)
    )
}

pub async fn search(
    client: &reqwest::Client,
    query: &str,
    kind: ProjectType,
    game: Option<&str>,
    loader: Option<&str>,
    offset: u32,
) -> Result<SearchResult> {
    get_json(client, &search_url(query, kind, game, loader, offset)).await
}

#[derive(Debug, Clone, Deserialize)]
struct Version {
    id: String,
    project_id: String,
    files: Vec<VersionFile>,
    #[serde(default)]
    dependencies: Vec<Dependency>,
}

#[derive(Debug, Clone, Deserialize)]
struct VersionFile {
    url: String,
    filename: String,
    #[serde(default)]
    primary: bool,
    hashes: HashMap<String, String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Dependency {
    project_id: Option<String>,
    version_id: Option<String>,
    dependency_type: String,
}

#[derive(Debug, Clone, Deserialize)]
struct Project {
    title: String,
    #[serde(default)]
    icon_url: Option<String>,
}

async fn compatible_version(client: &reqwest::Client, project: &str, game: &str, loader: &str) -> Result<Option<Version>> {
    let url = format!(
        "{API}/project/{project}/version?loaders={}&game_versions={}",
        enc(&format!(r#"["{loader}"]"#)),
        enc(&format!(r#"["{game}"]"#))
    );
    let list: Vec<Version> = get_json(client, &url).await?;
    Ok(list.into_iter().next())
}

fn primary(v: &Version) -> Result<&VersionFile> {
    v.files.iter().find(|f| f.primary).or(v.files.first()).ok_or_else(|| anyhow!("у версии мода нет файлов"))
}

/// Installs a mod and its required dependencies into an instance.
/// Returns the titles of everything that was added.
pub async fn install_mod(client: &reqwest::Client, paths: &Paths, inst: &mut Instance, project_id: &str) -> Result<Vec<String>> {
    let loader = inst.loader.modrinth().ok_or_else(|| anyhow!("Моды ставятся только в сборки с Fabric, Quilt, Forge или NeoForge"))?;
    let game = inst.game_version.clone();
    let mut queue = vec![project_id.to_string()];
    let mut seen: HashSet<String> = inst.mods.iter().map(|m| m.project_id.clone()).collect();
    let mut added = Vec::new();
    let first = project_id.to_string();

    while let Some(pid) = queue.pop() {
        if !seen.insert(pid.clone()) && pid != first {
            continue;
        }
        let Some(version) = compatible_version(client, &pid, &game, loader).await? else {
            if pid == first {
                bail!("Нет версии этого мода для {game} ({loader})");
            }
            continue;
        };
        let file = primary(&version)?;
        let dest = instances::mods_dir(paths, &inst.id).join(&file.filename);
        download::fetch(client, &Job { url: file.url.clone(), dest, sha1: file.hashes.get("sha1").cloned() }).await?;
        let project: Project = get_json(client, &format!("{API}/project/{pid}")).await?;
        // Replace an older file of the same project.
        if let Some(old) = inst.mods.iter().find(|m| m.project_id == pid && m.file_name != file.filename).cloned() {
            let _ = instances::remove_mod(paths, inst, &old.file_name);
        }
        inst.mods.retain(|m| m.project_id != pid);
        inst.mods.push(InstalledMod {
            project_id: pid.clone(),
            version_id: version.id.clone(),
            file_name: file.filename.clone(),
            title: project.title.clone(),
            icon_url: project.icon_url.clone(),
        });
        added.push(project.title);
        for dep in version.dependencies.iter().filter(|d| d.dependency_type == "required") {
            if let Some(p) = &dep.project_id {
                if !seen.contains(p) {
                    queue.push(p.clone());
                }
            } else if let Some(vid) = &dep.version_id {
                if let Ok(v) = get_json::<Version>(client, &format!("{API}/version/{vid}")).await {
                    if !seen.contains(&v.project_id) {
                        queue.push(v.project_id);
                    }
                }
            }
        }
        inst.save(paths)?;
    }
    Ok(added)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackIndex {
    files: Vec<PackFile>,
    dependencies: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct PackFile {
    path: String,
    hashes: HashMap<String, String>,
    #[serde(default)]
    env: Option<HashMap<String, String>>,
    downloads: Vec<String>,
}

fn pack_loader(deps: &HashMap<String, String>) -> (Loader, Option<String>) {
    for (key, loader) in [
        ("fabric-loader", Loader::Fabric),
        ("quilt-loader", Loader::Quilt),
        ("neoforge", Loader::NeoForge),
        ("forge", Loader::Forge),
    ] {
        if let Some(v) = deps.get(key) {
            // Forge versions are stored without the game prefix in mrpack.
            let v = if loader == Loader::Forge { format!("{}-{v}", deps.get("minecraft").cloned().unwrap_or_default()) } else { v.clone() };
            return (loader, Some(v));
        }
    }
    (Loader::Vanilla, None)
}

/// A pack path must stay inside the instance folder.
fn safe_relative(path: &str) -> Option<std::path::PathBuf> {
    let p = std::path::Path::new(path);
    if p.is_absolute() || p.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
        return None;
    }
    Some(p.to_path_buf())
}

/// Downloads the newest version of a modpack and creates an instance from it.
pub async fn install_modpack(client: &reqwest::Client, paths: &Paths, project_id: &str, progress: &ProgressFn) -> Result<Instance> {
    progress(Progress { stage: "modpack".into(), done: 0, total: 1 });
    let versions: Vec<Version> = get_json(client, &format!("{API}/project/{project_id}/version")).await?;
    let version = versions.first().ok_or_else(|| anyhow!("У модпака нет версий"))?;
    let file = primary(version)?;
    let project: Project = get_json(client, &format!("{API}/project/{project_id}")).await?;
    let pack_path = paths.root.join("installers").join(&file.filename);
    download::fetch(client, &Job { url: file.url.clone(), dest: pack_path.clone(), sha1: file.hashes.get("sha1").cloned() }).await?;

    let mut zip = zip::ZipArchive::new(std::fs::File::open(&pack_path)?).context("модпак повреждён")?;
    let index: PackIndex = {
        let mut s = String::new();
        zip.by_name("modrinth.index.json")?.read_to_string(&mut s)?;
        serde_json::from_str(&s)?
    };
    let game = index.dependencies.get("minecraft").cloned().ok_or_else(|| anyhow!("в модпаке не указана версия игры"))?;
    let (loader, loader_version) = pack_loader(&index.dependencies);
    let mut inst = instances::create(paths, &project.title, &game, loader, loader_version)?;
    inst.icon_url = project.icon_url.clone();
    inst.save(paths)?;

    let game_dir = inst.game_dir(paths);
    let jobs: Vec<Job> = index
        .files
        .iter()
        .filter(|f| f.env.as_ref().and_then(|e| e.get("client")).map(|c| c != "unsupported").unwrap_or(true))
        .filter_map(|f| {
            Some(Job {
                url: f.downloads.first()?.clone(),
                dest: game_dir.join(safe_relative(&f.path)?),
                sha1: f.hashes.get("sha1").cloned(),
            })
        })
        .collect();
    download::fetch_all(client, jobs, "mods", progress).await?;

    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        let rel = name.strip_prefix("overrides/").or_else(|| name.strip_prefix("client-overrides/"));
        let Some(rel) = rel.and_then(safe_relative) else { continue };
        if entry.is_dir() || rel.as_os_str().is_empty() {
            continue;
        }
        let dest = game_dir.join(rel);
        crate::paths::ensure_parent(&dest)?;
        std::io::copy(&mut entry, &mut std::fs::File::create(dest)?)?;
    }
    let _ = std::fs::remove_file(pack_path);
    progress(Progress { stage: "modpack".into(), done: 1, total: 1 });
    Ok(inst)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_search_url() {
        let u = search_url("sodium mod", ProjectType::Mod, Some("1.21.1"), Some("fabric"), 20);
        assert!(u.starts_with("https://api.modrinth.com/v2/search?query=sodium%20mod&facets="));
        assert!(u.contains("versions%3A1.21.1"));
        assert!(u.contains("categories%3Afabric"));
        assert!(u.ends_with("offset=20"));
    }

    #[test]
    fn pack_loaders() {
        let d = HashMap::from([("minecraft".to_string(), "1.20.1".to_string()), ("forge".to_string(), "47.3.0".to_string())]);
        assert_eq!(pack_loader(&d), (Loader::Forge, Some("1.20.1-47.3.0".into())));
        let d = HashMap::from([("minecraft".to_string(), "1.21.1".to_string())]);
        assert_eq!(pack_loader(&d).0, Loader::Vanilla);
    }

    #[test]
    fn rejects_escaping_paths() {
        assert!(safe_relative("mods/a.jar").is_some());
        assert!(safe_relative("../evil.jar").is_none());
        assert!(safe_relative("/etc/passwd").is_none());
    }
}
