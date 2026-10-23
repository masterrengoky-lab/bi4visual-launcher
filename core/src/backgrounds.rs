//! Custom background pictures for the launcher window.

use crate::paths::Paths;
use anyhow::{bail, Result};
use base64::Engine;
use std::path::PathBuf;

const MAX_BYTES: usize = 25 * 1024 * 1024;

pub fn dir(paths: &Paths) -> PathBuf {
    paths.root.join("backgrounds")
}

/// Recognises the picture by its first bytes, so the extension cannot lie.
pub fn sniff(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG") {
        Some(("png", "image/png"))
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("jpg", "image/jpeg"))
    } else if bytes.starts_with(b"GIF8") {
        Some(("gif", "image/gif"))
    } else if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("webp", "image/webp"))
    } else {
        None
    }
}

/// Saves a new background and removes the old ones. Returns the new file name.
pub fn save(paths: &Paths, bytes: &[u8]) -> Result<String> {
    if bytes.len() > MAX_BYTES {
        bail!("Картинка больше 25 МБ");
    }
    let Some((ext, _)) = sniff(bytes) else { bail!("Подходят PNG, JPG, WEBP или GIF") };
    let d = dir(paths);
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d)?;
    let name = format!("background-{}.{ext}", crate::instances::now());
    std::fs::write(d.join(&name), bytes)?;
    Ok(name)
}

/// Same as [`save`], for a picture sent from the UI as base64 (with or without a `data:` prefix).
pub fn save_base64(paths: &Paths, data: &str) -> Result<String> {
    let raw = data.split_once(',').map(|(_, b)| b).unwrap_or(data);
    let bytes = base64::engine::general_purpose::STANDARD.decode(raw.trim())?;
    save(paths, &bytes)
}

pub fn clear(paths: &Paths) {
    let _ = std::fs::remove_dir_all(dir(paths));
}

/// The background as a `data:` URL for the UI.
pub fn load(paths: &Paths, name: &str) -> Option<String> {
    if name.contains(['/', '\\']) || name.contains("..") {
        return None;
    }
    let bytes = std::fs::read(dir(paths).join(name)).ok()?;
    let (_, mime) = sniff(&bytes)?;
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_load_clear() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        assert!(save(&paths, b"hello world, not an image").is_err());
        let name = save(&paths, b"\x89PNG\r\n\x1a\nrest").unwrap();
        assert!(load(&paths, &name).unwrap().starts_with("data:image/png;base64,"));
        assert!(load(&paths, "../settings.json").is_none());
        clear(&paths);
        assert!(load(&paths, &name).is_none());
    }
}
