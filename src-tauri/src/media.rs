//! Watches the music playing in the system while the game runs and keeps
//! `bi4visual/nowplaying.json` in the game folder up to date for the mod.

use bi4visual_core::lyrics::{self, NowPlaying};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The track as the system reports it.
#[derive(Debug, Clone, PartialEq)]
pub struct Track {
    pub title: String,
    pub artist: String,
    pub playing: bool,
    pub position_ms: u64,
    pub duration_ms: Option<u64>,
}

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Runs until `stop` is set, then removes the file.
pub async fn watch(client: reqwest::Client, game_dir: PathBuf, stop: Arc<AtomicBool>) {
    let mut np = NowPlaying::default();
    let mut written = false;
    while !stop.load(Ordering::Relaxed) {
        let track = tokio::task::spawn_blocking(current).await.ok().flatten();
        let mut changed = false;
        match track {
            Some(t) if !t.title.is_empty() => {
                if t.title != np.title || t.artist != np.artist {
                    let lines = lyrics::fetch(&client, &t.title, &t.artist, t.duration_ms).await.unwrap_or_default();
                    np = NowPlaying { title: t.title.clone(), artist: t.artist.clone(), lines, ..Default::default() };
                    changed = true;
                }
                // Rewrite only on pause/play or a seek, the mod advances the clock itself.
                let predicted = if np.playing { np.position_ms + now_ms().saturating_sub(np.updated_at_ms) } else { np.position_ms };
                if changed || t.playing != np.playing || predicted.abs_diff(t.position_ms) > 1500 {
                    np.playing = t.playing;
                    np.position_ms = t.position_ms;
                    np.updated_at_ms = now_ms();
                    changed = true;
                }
            }
            _ => {
                if written {
                    lyrics::clear(&game_dir);
                    written = false;
                }
                np = NowPlaying::default();
            }
        }
        if changed && lyrics::write(&game_dir, &np).is_ok() {
            written = true;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    lyrics::clear(&game_dir);
}

/// Reads the current media session (Spotify, Yandex Music, a browser tab…).
#[cfg(windows)]
fn current() -> Option<Track> {
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };

    let manager = Manager::RequestAsync().ok()?.join().ok()?;
    let session = manager.GetCurrentSession().ok()?;
    let props = session.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
    let title = props.Title().ok()?.to_string_lossy();
    let artist = props.Artist().map(|a| a.to_string_lossy()).unwrap_or_default();
    let playing = session.GetPlaybackInfo().ok()?.PlaybackStatus().ok()? == Status::Playing;

    let timeline = session.GetTimelineProperties().ok()?;
    // TimeSpan and DateTime count 100 ns ticks; DateTime starts in 1601.
    let pos = timeline.Position().ok()?.Duration.max(0) as u64 / 10_000;
    let end = timeline.EndTime().ok().map(|e| e.Duration.max(0) as u64 / 10_000).filter(|&e| e > 0);
    let updated = timeline.LastUpdatedTime().ok()?.UniversalTime / 10_000 - 11_644_473_600_000;
    let position_ms = if playing && updated > 0 { pos + now_ms().saturating_sub(updated as u64) } else { pos };
    Some(Track { title, artist, playing, position_ms, duration_ms: end })
}

#[cfg(not(windows))]
fn current() -> Option<Track> {
    None
}
