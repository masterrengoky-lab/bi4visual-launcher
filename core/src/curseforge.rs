//! CurseForge: search and install mods and resource packs. The API needs a
//! personal key (free at console.curseforge.com), which the player enters in
//! the settings.

use crate::download::{self, Job};
use crate::instances::{self, InstalledMod, Instance, Loader};
use crate::modrinth::{Hit, SearchResult};
use crate::paths::Paths;
use anyhow::{anyhow, bail, Context, Result};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::collections::HashSet;

const API: &str = "https://api.curseforge.com/v1";
const MINECRAFT: u32 = 432;
const CLASS_MODS: u32 = 6;
const CLASS_RESOURCEPACKS: u32 = 12;
/// Our project ids are prefixed so they never clash with Modrinth ones.
pub const PREFIX: &str = "cf:";

fn loader_type(l: Loader) -> Option<u32> {
    match l {
        Loader::Forge => Some(1),
        Loader::Fabric => Some(4),
        Loader::Quilt => Some(5),
        Loader::NeoForge => Some(6),
        Loader::Vanilla => None,
    }
}

async fn get<T: DeserializeOwned>(client: &reqwest::Client, key: &str, url: &str) -> Result<T> {
    let resp = client.get(url).header("x-api-key", key).header("Accept", "application/json").send().await?;
    if resp.status() == reqwest::StatusCode::FORBIDDEN || resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        bail!("CurseForge не принял API-ключ. Проверьте его в настройках");
    }
    resp.error_for_status()?.json().await.context("CurseForge вернул неожиданный ответ")
}

#[derive(Deserialize)]
struct Data<T> {
    data: T,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Mod {
    id: u64,
    name: String,
    slug: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    download_count: f64,
    #[serde(default)]
    logo: Option<Logo>,
    #[serde(default)]
    authors: Vec<Named>,
    #[serde(default)]
    categories: Vec<Named>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Logo {
    thumbnail_url: Option<String>,
}

#[derive(Deserialize)]
struct Named {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Search {
    data: Vec<Mod>,
    pagination: Pagination,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pagination {
    total_count: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct File {
    id: u64,
    file_name: String,
    download_url: Option<String>,
    #[serde(default)]
    hashes: Vec<Hash>,
    #[serde(default)]
    dependencies: Vec<Dep>,
}

#[derive(Deserialize)]
struct Hash {
    value: String,
    algo: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Dep {
    mod_id: u64,
    relation_type: u32,
}

fn enc(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// `sort`: "downloads", "updated", "newest" or anything else for relevance.
pub fn search_url(query: &str, resourcepacks: bool, game: Option<&str>, loader: Option<Loader>, sort: &str, offset: u32) -> String {
    let class = if resourcepacks { CLASS_RESOURCEPACKS } else { CLASS_MODS };
    // sortField: 1 featured, 2 popularity, 3 last updated, 6 total downloads, 11 released
    let field = match sort {
        "downloads" => 6,
        "updated" => 3,
        "newest" => 11,
        _ => 2,
    };
    let mut u = format!(
        "{API}/mods/search?gameId={MINECRAFT}&classId={class}&searchFilter={}&sortField={field}&sortOrder=desc&pageSize=20&index={offset}",
        enc(query)
    );
    if let Some(g) = game {
        u.push_str(&format!("&gameVersion={}", enc(g)));
    }
    if let Some(t) = loader.filter(|_| !resourcepacks).and_then(loader_type) {
        u.push_str(&format!("&modLoaderType={t}"));
    }
    u
}

pub async fn search(
    client: &reqwest::Client,
    key: &str,
    query: &str,
    resourcepacks: bool,
    game: Option<&str>,
    loader: Option<Loader>,
    sort: &str,
    offset: u32,
) -> Result<SearchResult> {
    let r: Search = get(client, key, &search_url(query, resourcepacks, game, loader, sort, offset)).await?;
    Ok(SearchResult {
        // CurseForge does not page past 10 000 results.
        total_hits: r.pagination.total_count.min(10_000),
        hits: r
            .data
            .into_iter()
            .map(|m| Hit {
                project_id: format!("{PREFIX}{}", m.id),
                slug: m.slug,
                title: m.name,
                description: m.summary,
                icon_url: m.logo.and_then(|l| l.thumbnail_url),
                downloads: m.download_count as u64,
                author: m.authors.into_iter().next().map(|a| a.name).unwrap_or_default(),
                categories: m.categories.into_iter().map(|c| c.name).take(3).collect(),
            })
            .collect(),
    })
}

fn parse_id(project: &str) -> Result<u64> {
    project.strip_prefix(PREFIX).unwrap_or(project).parse().map_err(|_| anyhow!("Неверный id CurseForge"))
}

async fn newest_file(client: &reqwest::Client, key: &str, id: u64, game: &str, loader: Option<Loader>) -> Result<Option<File>> {
    let mut url = format!("{API}/mods/{id}/files?gameVersion={}&pageSize=1", enc(game));
    if let Some(t) = loader.and_then(loader_type) {
        url.push_str(&format!("&modLoaderType={t}"));
    }
    let r: Data<Vec<File>> = get(client, key, &url).await?;
    Ok(r.data.into_iter().next())
}

fn job(f: &File, dest: std::path::PathBuf) -> Result<Job> {
    let url = f
        .download_url
        .clone()
        .ok_or_else(|| anyhow!("Автор запретил скачивать {} через лаунчеры. Скачайте его с сайта CurseForge", f.file_name))?;
    Ok(Job { url, dest, sha1: f.hashes.iter().find(|h| h.algo == 1).map(|h| h.value.clone()) })
}

/// Installs a mod with its required dependencies. Returns the added titles.
pub async fn install_mod(client: &reqwest::Client, key: &str, paths: &Paths, inst: &mut Instance, project: &str) -> Result<Vec<String>> {
    if inst.loader == Loader::Vanilla {
        bail!("Моды ставятся только в сборки с Fabric, Quilt, Forge или NeoForge");
    }
    let first = parse_id(project)?;
    let mut queue = vec![first];
    let mut seen: HashSet<String> = inst.mods.iter().map(|m| m.project_id.clone()).collect();
    let mut added = Vec::new();
    while let Some(id) = queue.pop() {
        let pid = format!("{PREFIX}{id}");
        if !seen.insert(pid.clone()) && id != first {
            continue;
        }
        let Some(file) = newest_file(client, key, id, &inst.game_version.clone(), Some(inst.loader)).await? else {
            if id == first {
                bail!("Нет версии этого мода для {} ({:?})", inst.game_version, inst.loader);
            }
            continue;
        };
        download::fetch(client, &job(&file, instances::mods_dir(paths, &inst.id).join(&file.file_name))?).await?;
        let m: Data<Mod> = get(client, key, &format!("{API}/mods/{id}")).await?;
        if let Some(old) = inst.mods.iter().find(|x| x.project_id == pid && x.file_name != file.file_name).cloned() {
            let _ = instances::remove_mod(paths, inst, &old.file_name);
        }
        inst.mods.retain(|x| x.project_id != pid);
        inst.mods.push(InstalledMod {
            project_id: pid,
            version_id: file.id.to_string(),
            file_name: file.file_name.clone(),
            title: m.data.name.clone(),
            icon_url: m.data.logo.and_then(|l| l.thumbnail_url),
        });
        added.push(m.data.name);
        // relationType 3 = required dependency
        queue.extend(file.dependencies.iter().filter(|d| d.relation_type == 3).map(|d| d.mod_id));
        inst.save(paths)?;
    }
    Ok(added)
}

/// Downloads a resource pack and turns it on. Returns its title.
pub async fn install_resourcepack(client: &reqwest::Client, key: &str, paths: &Paths, inst: &Instance, project: &str) -> Result<String> {
    let id = parse_id(project)?;
    let file = match newest_file(client, key, id, &inst.game_version, None).await? {
        Some(f) => f,
        None => {
            let r: Data<Vec<File>> = get(client, key, &format!("{API}/mods/{id}/files?pageSize=1")).await?;
            r.data.into_iter().next().ok_or_else(|| anyhow!("У ресурспака нет файлов"))?
        }
    };
    let game_dir = inst.game_dir(paths);
    download::fetch(client, &job(&file, game_dir.join("resourcepacks").join(&file.file_name))?).await?;
    crate::resourcepacks::set_enabled(&game_dir, &file.file_name, true)?;
    let m: Data<Mod> = get(client, key, &format!("{API}/mods/{id}")).await?;
    Ok(m.data.name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_search_url() {
        let u = search_url("jei", false, Some("1.20.1"), Some(Loader::Forge), "downloads", 40);
        assert!(u.contains("classId=6"));
        assert!(u.contains("searchFilter=jei"));
        assert!(u.contains("sortField=6"));
        assert!(u.contains("gameVersion=1.20.1"));
        assert!(u.contains("modLoaderType=1"));
        assert!(u.contains("index=40"));
        let u = search_url("", true, None, Some(Loader::Fabric), "", 0);
        assert!(u.contains("classId=12"));
        assert!(!u.contains("modLoaderType"));
    }

    #[test]
    fn parses_ids() {
        assert_eq!(parse_id("cf:238222").unwrap(), 238222);
        assert!(parse_id("cf:abc").is_err());
    }
}
