//! Finds or downloads the Java runtime a Minecraft version needs (Eclipse Temurin).

use crate::download::{self, Job};
use crate::paths::Paths;
use crate::{Progress, ProgressFn};
use anyhow::{anyhow, Context, Result};
use std::path::{Path, PathBuf};

/// Temurin has no Java 16 builds; 17 runs 1.17 fine.
fn normalize_major(major: u32) -> u32 {
    if major == 16 {
        17
    } else {
        major
    }
}

fn adoptium_os() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    }
}

fn adoptium_arch(major: u32) -> &'static str {
    if cfg!(target_arch = "aarch64") {
        // No Java 8 for Apple Silicon; the x64 build runs under Rosetta.
        if cfg!(target_os = "macos") && major == 8 {
            "x64"
        } else {
            "aarch64"
        }
    } else if cfg!(target_arch = "x86") {
        "x86"
    } else {
        "x64"
    }
}

fn java_binary_name() -> &'static str {
    // javaw has no console window on Windows.
    if cfg!(target_os = "windows") {
        "javaw.exe"
    } else {
        "java"
    }
}

/// Looks for `bin/java` anywhere under `dir` (archives contain a versioned top folder).
pub fn find_java_in(dir: &Path) -> Option<PathBuf> {
    let direct = dir.join("bin").join(java_binary_name());
    if direct.is_file() {
        return Some(direct);
    }
    for e in std::fs::read_dir(dir).ok()?.flatten() {
        if e.path().is_dir() {
            if let Some(p) = find_java_in(&e.path()) {
                return Some(p);
            }
        }
    }
    None
}

/// Returns a Java binary for `major`, downloading it if needed.
pub async fn ensure(client: &reqwest::Client, paths: &Paths, major: u32, progress: &ProgressFn) -> Result<PathBuf> {
    let major = normalize_major(major);
    let dir = paths.java().join(major.to_string());
    if let Some(p) = find_java_in(&dir) {
        return Ok(p);
    }
    progress(Progress { stage: "java".into(), done: 0, total: 1 });
    let url = format!(
        "https://api.adoptium.net/v3/binary/latest/{major}/ga/{}/{}/jre/hotspot/normal/eclipse",
        adoptium_os(),
        adoptium_arch(major)
    );
    let archive = paths.java().join(format!("java-{major}.download"));
    download::fetch(client, &Job { url, dest: archive.clone(), sha1: None }).await?;

    let tmp = paths.java().join(format!("{major}.tmp"));
    let _ = std::fs::remove_dir_all(&tmp);
    let archive2 = archive.clone();
    let tmp2 = tmp.clone();
    tokio::task::spawn_blocking(move || unpack(&archive2, &tmp2)).await??;
    let _ = std::fs::remove_file(&archive);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::rename(&tmp, &dir)?;
    progress(Progress { stage: "java".into(), done: 1, total: 1 });
    find_java_in(&dir).ok_or_else(|| anyhow!("в скачанной Java {major} не найден исполняемый файл"))
}

fn unpack(archive: &Path, dest: &Path) -> Result<()> {
    std::fs::create_dir_all(dest)?;
    let file = std::fs::File::open(archive)?;
    if cfg!(target_os = "windows") {
        zip::ZipArchive::new(file)?.extract(dest).context("не удалось распаковать Java")?;
    } else {
        let gz = flate2::read::GzDecoder::new(file);
        tar::Archive::new(gz).unpack(dest).context("не удалось распаковать Java")?;
    }
    Ok(())
}
