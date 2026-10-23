//! Mojang version manifest and per-version JSON files.

use crate::paths::Paths;
use crate::rules::Rule;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: Latest,
    pub versions: Vec<ManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Latest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    pub release_time: String,
    #[serde(default)]
    pub sha1: Option<String>,
}

pub async fn fetch_manifest(client: &reqwest::Client) -> Result<VersionManifest> {
    crate::download::get_json(client, MANIFEST_URL)
        .await
        .context("не удалось получить список версий Mojang")
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inherits_from: Option<String>,
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_class: Option<String>,
    /// Pre-1.13 versions keep game arguments in one string.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub minecraft_arguments: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arguments: Option<Arguments>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_index: Option<AssetIndexRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assets: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub downloads: Option<VersionDownloads>,
    #[serde(default)]
    pub libraries: Vec<Library>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub java_version: Option<JavaVersion>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Arguments {
    #[serde(default)]
    pub game: Vec<Argument>,
    #[serde(default)]
    pub jvm: Vec<Argument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Argument {
    Plain(String),
    Ruled { rules: Vec<Rule>, value: ArgValue },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ArgValue {
    One(String),
    Many(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexRef {
    pub id: String,
    pub url: String,
    #[serde(default)]
    pub sha1: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDownloads {
    pub client: Artifact,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaVersion {
    pub major_version: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha1: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub downloads: Option<LibraryDownloads>,
    /// Maven repository base, used by Fabric and Forge libraries.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rules: Option<Vec<Rule>>,
    /// Old-style natives: OS name to classifier, e.g. `"windows": "natives-windows-${arch}"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub natives: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryDownloads {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artifact: Option<Artifact>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classifiers: Option<HashMap<String, Artifact>>,
}

impl Library {
    /// `group:artifact[:classifier]`, used to drop duplicates between a loader and vanilla.
    pub fn key(&self) -> String {
        let p: Vec<&str> = self.name.split('@').next().unwrap_or("").split(':').collect();
        match p.as_slice() {
            [g, a, _v, c, ..] => format!("{g}:{a}:{c}"),
            [g, a, ..] => format!("{g}:{a}"),
            _ => self.name.clone(),
        }
    }

    /// The main jar of this library, if it has one.
    pub fn main_artifact(&self) -> Option<Artifact> {
        if let Some(a) = self.downloads.as_ref().and_then(|d| d.artifact.clone()) {
            let path = a.path.clone().or_else(|| crate::paths::maven_path(&self.name));
            return Some(Artifact { path, ..a });
        }
        if self.downloads.is_some() && self.natives.is_some() {
            // Old LWJGL natives-only entries carry no main jar.
            return None;
        }
        let path = crate::paths::maven_path(&self.name)?;
        let base = self.url.as_deref().unwrap_or("https://libraries.minecraft.net/");
        let base = base.trim_end_matches('/');
        Some(Artifact {
            url: format!("{base}/{path}"),
            path: Some(path),
            sha1: None,
            size: None,
        })
    }

    /// The natives jar for the current OS, for versions before 1.19.
    pub fn natives_artifact(&self) -> Option<Artifact> {
        let natives = self.natives.as_ref()?;
        let classifier = natives
            .get(crate::rules::os_name())?
            .replace("${arch}", if crate::rules::is_32bit() { "32" } else { "64" });
        let a = self.downloads.as_ref()?.classifiers.as_ref()?.get(&classifier)?.clone();
        let path = a
            .path
            .clone()
            .or_else(|| crate::paths::maven_path(&format!("{}:{classifier}", self.name)));
        Some(Artifact { path, ..a })
    }

    /// New-style natives (1.19+) are normal libraries named `...:natives-<os>`.
    pub fn is_natives_jar(&self) -> bool {
        self.name.contains(":natives-")
    }
}

impl VersionJson {
    pub fn load(paths: &Paths, id: &str) -> Result<Self> {
        let raw = std::fs::read_to_string(paths.version_json(id))
            .with_context(|| format!("версия {id} не установлена"))?;
        Ok(serde_json::from_str(&raw)?)
    }

    /// Loads a version and everything it inherits from, merged into one.
    pub fn load_resolved(paths: &Paths, id: &str) -> Result<Self> {
        let v = Self::load(paths, id)?;
        match v.inherits_from.clone() {
            Some(parent) => Ok(v.merge_onto(Self::load_resolved(paths, &parent)?)),
            None => Ok(v),
        }
    }

    /// Lays this (child) version over its parent. The child's libraries come
    /// first and win over the parent's copy of the same library.
    pub fn merge_onto(self, parent: VersionJson) -> VersionJson {
        let mut seen = std::collections::HashSet::new();
        let mut libraries = Vec::new();
        for lib in self.libraries.into_iter().chain(parent.libraries) {
            if seen.insert(lib.key()) {
                libraries.push(lib);
            }
        }
        let arguments = match (self.arguments, parent.arguments) {
            (Some(c), Some(p)) => Some(Arguments {
                game: p.game.into_iter().chain(c.game).collect(),
                jvm: p.jvm.into_iter().chain(c.jvm).collect(),
            }),
            (c, p) => c.or(p),
        };
        VersionJson {
            id: self.id,
            inherits_from: None,
            kind: self.kind.or(parent.kind),
            main_class: self.main_class.or(parent.main_class),
            minecraft_arguments: self.minecraft_arguments.or(parent.minecraft_arguments),
            arguments,
            asset_index: self.asset_index.or(parent.asset_index),
            assets: self.assets.or(parent.assets),
            downloads: self.downloads.or(parent.downloads),
            libraries,
            java_version: self.java_version.or(parent.java_version),
        }
    }

    /// The version whose client jar is used (the root of the inheritance chain).
    pub fn jar_id(paths: &Paths, id: &str) -> Result<String> {
        let v = Self::load(paths, id)?;
        match v.inherits_from {
            Some(parent) => Self::jar_id(paths, &parent),
            None => Ok(id.to_string()),
        }
    }

    pub fn java_major(&self) -> u32 {
        self.java_version.as_ref().map(|j| j.major_version).unwrap_or(8)
    }
}

/// Lists version ids that have a JSON file on disk.
pub fn installed_versions(paths: &Paths) -> Vec<String> {
    let Ok(dir) = std::fs::read_dir(paths.versions()) else { return vec![] };
    let mut out: Vec<String> = dir
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|id| paths.version_json(id).exists())
        .collect();
    out.sort();
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modern_and_merges_fabric() {
        let vanilla: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "1.21.1",
            "type": "release",
            "mainClass": "net.minecraft.client.main.Main",
            "arguments": {
                "game": ["--username", "${auth_player_name}",
                    {"rules": [{"action": "allow", "features": {"is_demo_user": true}}], "value": "--demo"}],
                "jvm": ["-cp", "${classpath}"]
            },
            "assetIndex": {"id": "17", "url": "https://x/17.json"},
            "javaVersion": {"majorVersion": 21},
            "libraries": [
                {"name": "org.ow2.asm:asm:9.3", "downloads": {"artifact": {"path": "org/ow2/asm/asm/9.3/asm-9.3.jar", "url": "https://x/asm.jar"}}},
                {"name": "org.lwjgl:lwjgl:3.3.3:natives-windows", "downloads": {"artifact": {"url": "https://x/n.jar"}}}
            ]
        }))
        .unwrap();
        let fabric: VersionJson = serde_json::from_value(serde_json::json!({
            "id": "fabric-loader-0.16.9-1.21.1",
            "inheritsFrom": "1.21.1",
            "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
            "arguments": {"game": [], "jvm": ["-DFabricMcEmu= net.minecraft.client.main.Main "]},
            "libraries": [
                {"name": "org.ow2.asm:asm:9.7.1", "url": "https://maven.fabricmc.net/"},
                {"name": "net.fabricmc:fabric-loader:0.16.9", "url": "https://maven.fabricmc.net/"}
            ]
        }))
        .unwrap();
        let m = fabric.merge_onto(vanilla);
        assert_eq!(m.main_class.as_deref(), Some("net.fabricmc.loader.impl.launch.knot.KnotClient"));
        assert_eq!(m.java_major(), 21);
        assert_eq!(m.libraries.len(), 3, "fabric asm replaces vanilla asm");
        assert_eq!(m.libraries[0].name, "org.ow2.asm:asm:9.7.1");
        let a = m.libraries[0].main_artifact().unwrap();
        assert_eq!(a.url, "https://maven.fabricmc.net/org/ow2/asm/asm/9.7.1/asm-9.7.1.jar");
        assert!(m.libraries[2].is_natives_jar());
        assert_eq!(m.arguments.as_ref().unwrap().jvm.len(), 3);
    }

    #[test]
    fn old_natives() {
        let lib: Library = serde_json::from_value(serde_json::json!({
            "name": "org.lwjgl.lwjgl:lwjgl-platform:2.9.4",
            "natives": {"linux": "natives-linux", "osx": "natives-osx", "windows": "natives-windows-${arch}"},
            "downloads": {"classifiers": {
                "natives-linux": {"url": "https://x/l.jar"},
                "natives-osx": {"url": "https://x/o.jar"},
                "natives-windows-64": {"url": "https://x/w.jar"}
            }}
        }))
        .unwrap();
        assert!(lib.main_artifact().is_none());
        let n = lib.natives_artifact().unwrap();
        assert!(n.path.unwrap().starts_with("org/lwjgl/lwjgl/lwjgl-platform/2.9.4/"));
    }
}
