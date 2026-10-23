//! Instances ("сборки"): a game version, a loader and an own folder with mods,
//! saves and options, so different modpacks do not get in each other's way.

use crate::forge;
use crate::install;
use crate::manifest::VersionJson;
use crate::paths::Paths;
use crate::{fabric, java, ProgressFn};
use anyhow::{anyhow, bail, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Loader {
    Vanilla,
    Fabric,
    Quilt,
    Forge,
    NeoForge,
}

impl Loader {
    /// Name used by Modrinth.
    pub fn modrinth(self) -> Option<&'static str> {
        match self {
            Loader::Vanilla => None,
            Loader::Fabric => Some("fabric"),
            Loader::Quilt => Some("quilt"),
            Loader::Forge => Some("forge"),
            Loader::NeoForge => Some("neoforge"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledMod {
    pub project_id: String,
    pub version_id: String,
    pub file_name: String,
    pub title: String,
    #[serde(default)]
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub game_version: String,
    pub loader: Loader,
    /// Empty means the newest stable loader at install time.
    #[serde(default)]
    pub loader_version: Option<String>,
    /// The installed version id to launch, known after the first install.
    #[serde(default)]
    pub version_id: Option<String>,
    #[serde(default)]
    pub mods: Vec<InstalledMod>,
    #[serde(default)]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub created: u64,
    #[serde(default)]
    pub last_played: Option<u64>,
}

/// A file in the instance's mods folder, with what we know about it.
#[derive(Debug, Clone, Serialize)]
pub struct ModFile {
    pub file_name: String,
    pub enabled: bool,
    pub title: String,
    pub project_id: Option<String>,
    pub icon_url: Option<String>,
}

pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn root(paths: &Paths) -> PathBuf {
    paths.root.join("instances")
}

pub fn dir(paths: &Paths, id: &str) -> PathBuf {
    root(paths).join(id)
}

fn file(paths: &Paths, id: &str) -> PathBuf {
    dir(paths, id).join("instance.json")
}

pub fn mods_dir(paths: &Paths, id: &str) -> PathBuf {
    dir(paths, id).join("mods")
}

/// Folder-safe id from a display name: latin letters, digits and dashes.
pub fn slug(name: &str) -> String {
    let mut out = String::new();
    for c in name.chars().flat_map(|c| c.to_lowercase()) {
        let mapped = match c {
            'a'..='z' | '0'..='9' => Some(c.to_string()),
            '.' | '-' | '_' | ' ' => Some("-".into()),
            _ => translit(c).map(String::from),
        };
        if let Some(m) = mapped {
            if !(m == "-" && (out.is_empty() || out.ends_with('-'))) {
                out.push_str(&m);
            }
        }
    }
    let out = out.trim_end_matches('-').to_string();
    if out.is_empty() {
        "instance".into()
    } else {
        out
    }
}

fn translit(c: char) -> Option<&'static str> {
    Some(match c {
        'а' => "a", 'б' => "b", 'в' => "v", 'г' => "g", 'д' => "d", 'е' | 'ё' | 'э' => "e",
        'ж' => "zh", 'з' => "z", 'и' | 'й' => "i", 'к' => "k", 'л' => "l", 'м' => "m",
        'н' => "n", 'о' => "o", 'п' => "p", 'р' => "r", 'с' => "s", 'т' => "t", 'у' => "u",
        'ф' => "f", 'х' => "h", 'ц' => "c", 'ч' => "ch", 'ш' => "sh", 'щ' => "sch",
        'ы' => "y", 'ю' => "yu", 'я' => "ya",
        _ => return None,
    })
}

impl Instance {
    pub fn load(paths: &Paths, id: &str) -> Result<Self> {
        let raw = std::fs::read_to_string(file(paths, id)).map_err(|_| anyhow!("Сборка «{id}» не найдена"))?;
        Ok(serde_json::from_str(&raw)?)
    }

    pub fn save(&self, paths: &Paths) -> Result<()> {
        std::fs::create_dir_all(dir(paths, &self.id))?;
        std::fs::write(file(paths, &self.id), serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }

    pub fn game_dir(&self, paths: &Paths) -> PathBuf {
        dir(paths, &self.id)
    }
}

pub fn list(paths: &Paths) -> Vec<Instance> {
    let Ok(rd) = std::fs::read_dir(root(paths)) else { return vec![] };
    let mut v: Vec<Instance> = rd
        .flatten()
        .filter_map(|e| e.file_name().into_string().ok())
        .filter_map(|id| Instance::load(paths, &id).ok())
        .collect();
    // Most recently played first, then newest.
    v.sort_by_key(|i| std::cmp::Reverse(i.last_played.unwrap_or(0).max(i.created)));
    v
}

pub fn create(paths: &Paths, name: &str, game_version: &str, loader: Loader, loader_version: Option<String>) -> Result<Instance> {
    let name = name.trim();
    if name.is_empty() {
        bail!("Введите название сборки");
    }
    let base = slug(name);
    let mut id = base.clone();
    let mut n = 2;
    while dir(paths, &id).exists() {
        id = format!("{base}-{n}");
        n += 1;
    }
    let inst = Instance {
        id,
        name: name.to_string(),
        game_version: game_version.to_string(),
        loader,
        loader_version: loader_version.filter(|s| !s.is_empty()),
        version_id: None,
        mods: vec![],
        icon_url: None,
        created: now(),
        last_played: None,
    };
    inst.save(paths)?;
    std::fs::create_dir_all(mods_dir(paths, &inst.id))?;
    Ok(inst)
}

pub fn delete(paths: &Paths, id: &str) -> Result<()> {
    let d = dir(paths, id);
    if id.is_empty() || id.contains(['/', '\\']) || id.contains("..") || !d.starts_with(root(paths)) {
        bail!("неверная сборка");
    }
    std::fs::remove_dir_all(d)?;
    Ok(())
}

/// Installs the version, loader and libraries an instance needs and returns
/// the version id to launch.
pub async fn ensure_ready(client: &reqwest::Client, paths: &Paths, inst: &mut Instance, progress: &ProgressFn) -> Result<String> {
    if let Some(id) = &inst.version_id {
        if paths.version_json(id).exists() {
            install::install(client, paths, id, progress).await?;
            return Ok(id.clone());
        }
    }
    let game = inst.game_version.clone();
    install::install(client, paths, &game, progress).await?;
    let id = match inst.loader {
        Loader::Vanilla => game.clone(),
        Loader::Fabric | Loader::Quilt => {
            let flavor = if inst.loader == Loader::Fabric { fabric::Flavor::Fabric } else { fabric::Flavor::Quilt };
            let loader = match inst.loader_version.clone() {
                Some(v) => v,
                None => fabric::loader_versions(client, flavor, &game)
                    .await?
                    .into_iter()
                    .next()
                    .ok_or_else(|| anyhow!("Для {game} нет загрузчика {:?}", inst.loader))?,
            };
            fabric::install_profile(client, paths, flavor, &game, &loader).await?
        }
        Loader::Forge | Loader::NeoForge => {
            let flavor = if inst.loader == Loader::Forge { forge::Flavor::Forge } else { forge::Flavor::NeoForge };
            let version = match inst.loader_version.clone() {
                Some(v) => v,
                None => forge::versions(client, flavor, &game)
                    .await?
                    .into_iter()
                    .next()
                    .ok_or_else(|| anyhow!("Для {game} нет {:?}", inst.loader))?,
            };
            let major = VersionJson::load_resolved(paths, &game)?.java_major();
            let java_bin = java::ensure(client, paths, major, progress).await?;
            forge::install(client, paths, flavor, &version, &java_bin, progress).await?
        }
    };
    install::install(client, paths, &id, progress).await?;
    inst.version_id = Some(id.clone());
    inst.save(paths)?;
    Ok(id)
}

/// Files in the mods folder, enabled and disabled.
pub fn mod_files(paths: &Paths, inst: &Instance) -> Vec<ModFile> {
    let Ok(rd) = std::fs::read_dir(mods_dir(paths, &inst.id)) else { return vec![] };
    let mut out: Vec<ModFile> = rd
        .flatten()
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.ends_with(".jar") || n.ends_with(".jar.disabled"))
        .map(|name| {
            let base = name.trim_end_matches(".disabled").to_string();
            let meta = inst.mods.iter().find(|m| m.file_name == base);
            ModFile {
                enabled: !name.ends_with(".disabled"),
                title: meta.map(|m| m.title.clone()).unwrap_or_else(|| base.trim_end_matches(".jar").to_string()),
                project_id: meta.map(|m| m.project_id.clone()),
                icon_url: meta.and_then(|m| m.icon_url.clone()),
                file_name: base,
            }
        })
        .collect();
    out.sort_by_key(|m| m.title.to_lowercase());
    out
}

fn safe_name(file_name: &str) -> Result<&str> {
    if file_name.contains(['/', '\\']) || file_name.contains("..") {
        bail!("неверное имя файла");
    }
    Ok(file_name)
}

pub fn set_mod_enabled(paths: &Paths, inst: &Instance, file_name: &str, enabled: bool) -> Result<()> {
    let name = safe_name(file_name)?;
    let dir = mods_dir(paths, &inst.id);
    let on = dir.join(name);
    let off = dir.join(format!("{name}.disabled"));
    match (enabled, on.exists(), off.exists()) {
        (true, false, true) => std::fs::rename(off, on)?,
        (false, true, false) => std::fs::rename(on, off)?,
        _ => {}
    }
    Ok(())
}

pub fn remove_mod(paths: &Paths, inst: &mut Instance, file_name: &str) -> Result<()> {
    let name = safe_name(file_name)?;
    let dir = mods_dir(paths, &inst.id);
    let _ = std::fs::remove_file(dir.join(name));
    let _ = std::fs::remove_file(dir.join(format!("{name}.disabled")));
    inst.mods.retain(|m| m.file_name != name);
    inst.save(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs() {
        assert_eq!(slug("Моя сборка 1.21"), "moya-sborka-1-21");
        assert_eq!(slug("  Fabric  Mods!! "), "fabric-mods");
        assert_eq!(slug("★"), "instance");
    }

    #[test]
    fn create_list_mods_delete() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        let a = create(&paths, "Test", "1.21.1", Loader::Fabric, None).unwrap();
        let b = create(&paths, "Test", "1.20.1", Loader::Vanilla, None).unwrap();
        assert_eq!(b.id, "test-2");
        assert_eq!(list(&paths).len(), 2);

        std::fs::write(mods_dir(&paths, &a.id).join("sodium.jar"), b"x").unwrap();
        let mut a = Instance::load(&paths, &a.id).unwrap();
        a.mods.push(InstalledMod {
            project_id: "AANobbMI".into(),
            version_id: "v".into(),
            file_name: "sodium.jar".into(),
            title: "Sodium".into(),
            icon_url: None,
        });
        a.save(&paths).unwrap();
        set_mod_enabled(&paths, &a, "sodium.jar", false).unwrap();
        let files = mod_files(&paths, &a);
        assert_eq!(files.len(), 1);
        assert!(!files[0].enabled);
        assert_eq!(files[0].title, "Sodium");
        assert!(set_mod_enabled(&paths, &a, "../x.jar", true).is_err());
        remove_mod(&paths, &mut a, "sodium.jar").unwrap();
        assert!(mod_files(&paths, &a).is_empty());

        delete(&paths, &a.id).unwrap();
        assert!(delete(&paths, "..").is_err());
        assert_eq!(list(&paths).len(), 1);
    }
}
