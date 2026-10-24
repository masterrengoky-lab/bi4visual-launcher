//! Resource packs of an instance: the files in `resourcepacks/` and which of
//! them are turned on in options.txt.

use anyhow::{bail, Result};
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct PackFile {
    pub file_name: String,
    pub enabled: bool,
}

fn options(game_dir: &Path) -> std::path::PathBuf {
    game_dir.join("options.txt")
}

fn enabled_ids(game_dir: &Path) -> Vec<String> {
    std::fs::read_to_string(options(game_dir))
        .unwrap_or_default()
        .lines()
        .find_map(|l| l.strip_prefix("resourcePacks:"))
        .and_then(|l| serde_json::from_str(l).ok())
        .unwrap_or_default()
}

/// Packs the player put into the instance, except the launcher's own skin pack.
pub fn list(game_dir: &Path) -> Vec<PackFile> {
    let on = enabled_ids(game_dir);
    let mut out: Vec<PackFile> = std::fs::read_dir(game_dir.join("resourcepacks"))
        .map(|d| {
            d.flatten()
                .map(|e| e.file_name().to_string_lossy().to_string())
                .filter(|n| n != "kissvis-skin" && !n.ends_with(".part"))
                .map(|n| PackFile { enabled: on.contains(&format!("file/{n}")), file_name: n })
                .collect()
        })
        .unwrap_or_default();
    out.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    out
}

fn check_name(file: &str) -> Result<()> {
    if file.is_empty() || file.contains(['/', '\\']) || file.contains("..") {
        bail!("Неверное имя файла");
    }
    Ok(())
}

pub fn set_enabled(game_dir: &Path, file: &str, enable: bool) -> Result<()> {
    check_name(file)?;
    crate::skins::set_pack_enabled(&options(game_dir), &format!("file/{file}"), enable)
}

pub fn remove(game_dir: &Path, file: &str) -> Result<()> {
    check_name(file)?;
    set_enabled(game_dir, file, false)?;
    let p = game_dir.join("resourcepacks").join(file);
    if p.is_dir() {
        std::fs::remove_dir_all(p)?;
    } else {
        std::fs::remove_file(p)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toggles_packs() {
        let tmp = tempfile::tempdir().unwrap();
        let game = tmp.path();
        std::fs::create_dir_all(game.join("resourcepacks")).unwrap();
        std::fs::write(game.join("resourcepacks/Fresh.zip"), b"zip").unwrap();
        assert!(!list(game)[0].enabled);
        set_enabled(game, "Fresh.zip", true).unwrap();
        assert!(list(game)[0].enabled);
        assert!(set_enabled(game, "../x.zip", true).is_err());
        remove(game, "Fresh.zip").unwrap();
        assert!(list(game).is_empty());
        assert!(!std::fs::read_to_string(game.join("options.txt")).unwrap().contains("Fresh"));
    }
}
