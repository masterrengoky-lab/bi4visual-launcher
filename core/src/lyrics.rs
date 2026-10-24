//! Song lyrics shown inside the game while music plays.
//!
//! The launcher finds the playing track, fetches synced lyrics from LRCLIB
//! and writes `bi4visual/nowplaying.json` into the game directory. The
//! bi4visual mod reads that file and draws the current line in the world.

use crate::paths::ensure_parent;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Line {
    /// Start of the line from the beginning of the track, in milliseconds.
    pub t: u64,
    pub text: String,
}

/// What the mod reads. The mod computes the current position itself:
/// `position_ms + (now - updated_at_ms)` while `playing`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct NowPlaying {
    pub title: String,
    pub artist: String,
    pub playing: bool,
    pub position_ms: u64,
    /// Unix time in milliseconds when `position_ms` was true.
    pub updated_at_ms: u64,
    pub lines: Vec<Line>,
}

pub fn file(game_dir: &Path) -> PathBuf {
    game_dir.join("bi4visual").join("nowplaying.json")
}

pub fn write(game_dir: &Path, np: &NowPlaying) -> Result<()> {
    let path = file(game_dir);
    ensure_parent(&path)?;
    // Write then rename so the mod never reads a half-written file.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, serde_json::to_vec(np)?)?;
    std::fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn clear(game_dir: &Path) {
    let _ = std::fs::remove_file(file(game_dir));
}

/// Parses LRC text: `[mm:ss.xx] words`, several stamps per line allowed.
/// Empty lines are kept, they mark pauses between verses.
pub fn parse_lrc(lrc: &str) -> Vec<Line> {
    let mut out = Vec::new();
    for raw in lrc.lines() {
        let mut rest = raw.trim();
        let mut stamps = Vec::new();
        while let Some(body) = rest.strip_prefix('[') {
            let Some(end) = body.find(']') else { break };
            match parse_stamp(&body[..end]) {
                Some(t) => stamps.push(t),
                None => break, // [ar:...] style tags
            }
            rest = body[end + 1..].trim_start();
        }
        for t in stamps {
            out.push(Line { t, text: rest.trim().to_string() });
        }
    }
    out.sort_by_key(|l| l.t);
    out
}

fn parse_stamp(s: &str) -> Option<u64> {
    let (m, sec) = s.split_once(':')?;
    let m: u64 = m.trim().parse().ok()?;
    let sec: f64 = sec.trim().parse().ok()?;
    if !(0.0..60.0).contains(&sec) {
        return None;
    }
    Some(m * 60_000 + (sec * 1000.0).round() as u64)
}

#[derive(Deserialize)]
struct LrcLibTrack {
    #[serde(rename = "syncedLyrics")]
    synced: Option<String>,
    duration: Option<f64>,
}

/// Synced lyrics from lrclib.net, or an empty list when the song is unknown.
pub async fn fetch(client: &reqwest::Client, title: &str, artist: &str, duration_ms: Option<u64>) -> Result<Vec<Line>> {
    let title = clean_title(title);
    let q = if artist.is_empty() { title.clone() } else { format!("{artist} {title}") };
    let found: Vec<LrcLibTrack> = client
        .get("https://lrclib.net/api/search")
        .query(&[("q", q.as_str())])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    // Prefer the version whose length matches the playing track.
    let best = found
        .into_iter()
        .filter(|t| t.synced.as_deref().is_some_and(|s| !s.trim().is_empty()))
        .min_by_key(|t| match (duration_ms, t.duration) {
            (Some(d), Some(td)) => ((td * 1000.0) as i64 - d as i64).unsigned_abs(),
            _ => 0,
        });
    Ok(best.and_then(|t| t.synced).map(|s| parse_lrc(&s)).unwrap_or_default())
}

/// Drops the "(feat. …)", "[Official Video]" and similar parts players add.
fn clean_title(title: &str) -> String {
    let mut s = title.to_string();
    for (open, close) in [('(', ')'), ('[', ']')] {
        while let (Some(a), Some(b)) = (s.find(open), s.find(close)) {
            if b <= a {
                break;
            }
            s.replace_range(a..=b, "");
        }
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Puts the launcher's button colour into the mod's `<game_dir>/bi4visual/config.json`.
/// The other settings there belong to the mod (its Right Shift menu) and are kept.
pub fn write_accent(game_dir: &Path, accent: &str) -> Result<()> {
    let dir = game_dir.join("bi4visual");
    std::fs::create_dir_all(&dir)?;
    let file = dir.join("config.json");
    let mut cfg = std::fs::read(&file)
        .ok()
        .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
        .filter(|v| v.is_object())
        .unwrap_or_else(|| serde_json::json!({}));
    cfg["accent"] = serde_json::Value::String(accent.to_string());
    std::fs::write(file, serde_json::to_vec_pretty(&cfg)?)?;
    Ok(())
}

pub fn has_mod(bundled: &Path, game_version: &str) -> bool {
    bundled.join(format!("bi4visual-{game_version}.jar")).is_file()
}

/// Puts the bundled bi4visual mod for `game_version` into the instance's
/// mods folder, replacing an older copy. `bundled` holds `bi4visual-<mc>.jar`.
/// Returns false when there is no build of the mod for that version.
pub fn install_mod(bundled: &Path, mods_dir: &Path, game_version: &str, enabled: bool) -> Result<bool> {
    let src = bundled.join(format!("bi4visual-{game_version}.jar"));
    let dst = mods_dir.join("bi4visual.jar");
    if !enabled || !src.is_file() {
        if dst.exists() {
            std::fs::remove_file(&dst)?;
        }
        return Ok(false);
    }
    std::fs::create_dir_all(mods_dir)?;
    let same = std::fs::read(&dst).ok() == std::fs::read(&src).ok();
    if !same {
        std::fs::copy(&src, &dst)?;
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lrc() {
        let lines = parse_lrc("[ar:Someone]\n[00:12.50] Что ты\n[00:15.00][01:02.25]хочешь от меня\n[00:20.00]\n");
        assert_eq!(
            lines,
            vec![
                Line { t: 12_500, text: "Что ты".into() },
                Line { t: 15_000, text: "хочешь от меня".into() },
                Line { t: 20_000, text: "".into() },
                Line { t: 62_250, text: "хочешь от меня".into() },
            ]
        );
    }

    #[test]
    fn mod_install() {
        let dir = tempfile::tempdir().unwrap();
        let bundled = dir.path().join("b");
        let mods = dir.path().join("mods");
        std::fs::create_dir_all(&bundled).unwrap();
        std::fs::write(bundled.join("bi4visual-1.21.4.jar"), b"jar").unwrap();
        assert!(install_mod(&bundled, &mods, "1.21.4", true).unwrap());
        assert_eq!(std::fs::read(mods.join("bi4visual.jar")).unwrap(), b"jar");
        assert!(!install_mod(&bundled, &mods, "1.21.4", false).unwrap());
        assert!(!mods.join("bi4visual.jar").exists());
        assert!(!install_mod(&bundled, &mods, "1.20.1", true).unwrap());
    }

    #[test]
    fn titles() {
        assert_eq!(clean_title("Госпожа (feat. X) [Official Video]"), "Госпожа");
    }
}
