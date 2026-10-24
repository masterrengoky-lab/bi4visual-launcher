//! The player's own music for the launcher, kept in `<root>/music`.

use crate::paths::Paths;
use anyhow::{bail, Result};
use base64::Engine;
use std::path::PathBuf;

const MAX_BYTES: usize = 100 * 1024 * 1024;

pub fn dir(paths: &Paths) -> PathBuf {
    paths.root.join("music")
}

fn mime(name: &str) -> Option<&'static str> {
    let ext = name.rsplit_once('.')?.1.to_ascii_lowercase();
    Some(match ext.as_str() {
        "mp3" => "audio/mpeg",
        "ogg" | "oga" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" | "aac" => "audio/mp4",
        "flac" => "audio/flac",
        "opus" => "audio/ogg",
        _ => return None,
    })
}

/// A file name without folders, so a track can't be written or read elsewhere.
fn safe(name: &str) -> Option<&str> {
    let ok = !name.is_empty() && !name.contains(['/', '\\']) && !name.contains("..") && mime(name).is_some();
    ok.then_some(name)
}

/// Track file names, sorted.
pub fn list(paths: &Paths) -> Vec<String> {
    let mut out: Vec<String> = std::fs::read_dir(dir(paths))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| safe(n).is_some())
        .collect();
    out.sort_by_key(|n| n.to_lowercase());
    out
}

/// Saves a track sent from the UI as base64 (with or without a `data:` prefix).
pub fn add_base64(paths: &Paths, name: &str, data: &str) -> Result<String> {
    let Some(name) = safe(name) else { bail!("Подходят mp3, ogg, wav, m4a и flac") };
    let raw = data.split_once(',').map(|(_, b)| b).unwrap_or(data);
    let bytes = base64::engine::general_purpose::STANDARD.decode(raw.trim())?;
    if bytes.len() > MAX_BYTES {
        bail!("Файл больше 100 МБ");
    }
    std::fs::create_dir_all(dir(paths))?;
    std::fs::write(dir(paths).join(name), bytes)?;
    Ok(name.to_string())
}

pub fn remove(paths: &Paths, name: &str) -> Result<()> {
    if let Some(name) = safe(name) {
        std::fs::remove_file(dir(paths).join(name))?;
    }
    Ok(())
}

/// The track as a `data:` URL for the player.
pub fn load(paths: &Paths, name: &str) -> Option<String> {
    let name = safe(name)?;
    let bytes = std::fs::read(dir(paths).join(name)).ok()?;
    Some(format!("data:{};base64,{}", mime(name)?, base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn add_list_load_remove() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        assert!(add_base64(&paths, "evil.exe", "AAAA").is_err());
        assert!(add_base64(&paths, "../x.mp3", "AAAA").is_err());
        add_base64(&paths, "Song.mp3", "data:audio/mpeg;base64,SUQz").unwrap();
        assert_eq!(list(&paths), vec!["Song.mp3".to_string()]);
        assert!(load(&paths, "Song.mp3").unwrap().starts_with("data:audio/mpeg;base64,"));
        remove(&paths, "Song.mp3").unwrap();
        assert!(list(&paths).is_empty());
    }
}
