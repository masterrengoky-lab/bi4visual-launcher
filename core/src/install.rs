//! Installs a vanilla version: JSON, client jar, libraries, natives and assets.

use crate::download::{self, Job};
use crate::manifest::{fetch_manifest, AssetIndexRef, VersionJson};
use crate::paths::{ensure_parent, Paths};
use crate::ProgressFn;
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::collections::HashMap;

const RESOURCES_URL: &str = "https://resources.download.minecraft.net";

#[derive(Debug, Deserialize)]
struct AssetIndex {
    objects: HashMap<String, AssetObject>,
    #[serde(default)]
    r#virtual: bool,
    #[serde(default)]
    map_to_resources: bool,
}

#[derive(Debug, Deserialize)]
struct AssetObject {
    hash: String,
}

/// Downloads the JSON of a Mojang version if it is not on disk yet.
pub async fn ensure_vanilla_json(client: &reqwest::Client, paths: &Paths, id: &str) -> Result<()> {
    if paths.version_json(id).exists() {
        return Ok(());
    }
    let manifest = fetch_manifest(client).await?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| anyhow!("версия {id} не найдена у Mojang"))?;
    download::fetch(
        client,
        &Job {
            url: entry.url.clone(),
            dest: paths.version_json(id),
            sha1: entry.sha1.clone(),
        },
    )
    .await
}

/// Makes sure everything needed to start `id` is on disk.
/// Works for vanilla and for loader versions that inherit from vanilla.
pub async fn install(client: &reqwest::Client, paths: &Paths, id: &str, progress: &ProgressFn) -> Result<()> {
    if !paths.version_json(id).exists() {
        ensure_vanilla_json(client, paths, id).await?;
    }
    // Make sure the whole inheritance chain is present.
    let mut cur = VersionJson::load(paths, id)?;
    while let Some(parent) = cur.inherits_from.clone() {
        ensure_vanilla_json(client, paths, &parent).await?;
        cur = VersionJson::load(paths, &parent)?;
    }

    let v = VersionJson::load_resolved(paths, id)?;
    let jar_id = VersionJson::jar_id(paths, id)?;

    let mut jobs = Vec::new();
    if let Some(d) = &v.downloads {
        jobs.push(Job {
            url: d.client.url.clone(),
            dest: paths.version_jar(&jar_id),
            sha1: d.client.sha1.clone(),
        });
    }
    let features = HashMap::new();
    for lib in v.libraries.iter().filter(|l| crate::rules::allowed(l.rules.as_deref(), &features)) {
        for a in [lib.main_artifact(), lib.natives_artifact()].into_iter().flatten() {
            if let Some(path) = &a.path {
                jobs.push(Job {
                    url: a.url.clone(),
                    dest: paths.libraries().join(path),
                    sha1: a.sha1.clone(),
                });
            }
        }
    }
    download::fetch_all(client, jobs, "libraries", progress).await?;

    extract_natives(paths, &v)?;

    if let Some(index) = &v.asset_index {
        install_assets(client, paths, index, progress).await?;
    }
    Ok(())
}

/// Unpacks native libraries (.dll/.so/.dylib) next to the version.
pub fn extract_natives(paths: &Paths, v: &VersionJson) -> Result<()> {
    let dir = paths.natives(&v.id);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir)?;
    let features = HashMap::new();
    for lib in v.libraries.iter().filter(|l| crate::rules::allowed(l.rules.as_deref(), &features)) {
        let artifact = if lib.natives.is_some() {
            lib.natives_artifact()
        } else if lib.is_natives_jar() {
            lib.main_artifact()
        } else {
            None
        };
        let Some(path) = artifact.and_then(|a| a.path) else { continue };
        let jar = paths.libraries().join(path);
        let file = std::fs::File::open(&jar).with_context(|| format!("нет файла {}", jar.display()))?;
        let mut zip = zip::ZipArchive::new(file)?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i)?;
            let name = entry.name().to_string();
            if entry.is_dir() || name.starts_with("META-INF") {
                continue;
            }
            let lower = name.to_lowercase();
            if !(lower.ends_with(".dll") || lower.ends_with(".so") || lower.ends_with(".dylib") || lower.ends_with(".jnilib")) {
                continue;
            }
            // Flatten: LWJGL looks for the libraries directly in the folder.
            let Some(file_name) = std::path::Path::new(&name).file_name() else { continue };
            let mut out = std::fs::File::create(dir.join(file_name))?;
            std::io::copy(&mut entry, &mut out)?;
        }
    }
    Ok(())
}

async fn install_assets(
    client: &reqwest::Client,
    paths: &Paths,
    index_ref: &AssetIndexRef,
    progress: &ProgressFn,
) -> Result<()> {
    let index_path = paths.assets().join("indexes").join(format!("{}.json", index_ref.id));
    if !download::is_valid(&index_path, index_ref.sha1.as_deref()) {
        download::fetch(
            client,
            &Job {
                url: index_ref.url.clone(),
                dest: index_path.clone(),
                sha1: index_ref.sha1.clone(),
            },
        )
        .await?;
    }
    let index: AssetIndex = serde_json::from_str(&std::fs::read_to_string(&index_path)?)?;
    let objects = paths.assets().join("objects");
    let jobs = index
        .objects
        .values()
        .map(|o| Job {
            url: format!("{RESOURCES_URL}/{}/{}", &o.hash[..2], o.hash),
            dest: objects.join(&o.hash[..2]).join(&o.hash),
            sha1: Some(o.hash.clone()),
        })
        .collect();
    download::fetch_all(client, jobs, "assets", progress).await?;

    // Versions before 1.7 read assets by name instead of by hash.
    if index.r#virtual || index.map_to_resources {
        let virt = paths.assets().join("virtual").join(&index_ref.id);
        for (name, o) in &index.objects {
            let dest = virt.join(name);
            if !dest.exists() {
                ensure_parent(&dest)?;
                std::fs::copy(objects.join(&o.hash[..2]).join(&o.hash), &dest)?;
            }
        }
    }
    Ok(())
}

/// For old versions that expect assets in `<game dir>/resources`.
pub fn copy_legacy_resources(paths: &Paths, index_id: &str, game_dir: &std::path::Path) -> Result<()> {
    let virt = paths.assets().join("virtual").join(index_id);
    if !virt.exists() || index_id != "pre-1.6" {
        return Ok(());
    }
    copy_dir(&virt, &game_dir.join("resources"))
}

fn copy_dir(from: &std::path::Path, to: &std::path::Path) -> Result<()> {
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)? {
        let e = e?;
        let dest = to.join(e.file_name());
        if e.file_type()?.is_dir() {
            copy_dir(&e.path(), &dest)?;
        } else if !dest.exists() {
            std::fs::copy(e.path(), dest)?;
        }
    }
    Ok(())
}
