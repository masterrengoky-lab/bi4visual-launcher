//! Watches the music playing in the system while the game runs and keeps
//! `bi4visual/nowplaying.json` in the game folder up to date for the mod.

use kiss_core::lyrics::{self, NowPlaying};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The track as the system reports it.
#[derive(Debug, Clone, PartialEq)]
pub struct Track {
    /// The player's app id, e.g. Spotify.exe; shown in the log.
    pub app: String,
    pub title: String,
    pub artist: String,
    pub playing: bool,
    /// None when the player does not report where in the track it is.
    pub position_ms: Option<u64>,
    pub duration_ms: Option<u64>,
}

pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Runs until `stop` is set, then removes the file.
/// `log` gets a line for each new track, so the launcher log shows what was found.
pub async fn watch(client: reqwest::Client, game_dir: PathBuf, stop: Arc<AtomicBool>, log: impl Fn(String)) {
    let mut np = NowPlaying::default();
    let mut written = false;
    let mut silent_rounds = 0u32;
    // Some players (Yandex Music among them) report no position or a frozen one;
    // then the clock runs from the moment the track was first seen.
    let mut last_reported: Option<u64> = None;
    let mut frozen_rounds = 0u32;
    while !stop.load(Ordering::Relaxed) {
        let track = tokio::task::spawn_blocking(current).await.ok().flatten();
        let mut changed = false;
        match track {
            Some(t) if !t.title.is_empty() => {
                silent_rounds = 0;
                if t.title != np.title || t.artist != np.artist {
                    let lines = match lyrics::fetch(&client, &t.title, &t.artist, t.duration_ms).await {
                        Ok(lines) => {
                            log(if lines.is_empty() {
                                format!("Играет «{} — {}» ({}), но в базе LRCLIB нет синхронного текста", t.artist, t.title, t.app)
                            } else {
                                format!("Играет «{} — {}» ({}), текст найден: {} строк", t.artist, t.title, t.app, lines.len())
                            });
                            lines
                        }
                        Err(e) => {
                            log(format!("Играет «{} — {}», не удалось скачать текст: {e}", t.artist, t.title));
                            Vec::new()
                        }
                    };
                    np = NowPlaying { title: t.title.clone(), artist: t.artist.clone(), lines, ..Default::default() };
                    np.updated_at_ms = now_ms();
                    last_reported = None;
                    frozen_rounds = 0;
                    changed = true;
                }
                if t.playing && t.position_ms.is_some() && t.position_ms == last_reported {
                    frozen_rounds += 1;
                } else if t.position_ms != last_reported {
                    frozen_rounds = 0;
                }
                last_reported = t.position_ms;
                let reported = t.position_ms.filter(|_| frozen_rounds < 6);

                // Rewrite only on pause/play or a seek, the mod advances the clock itself.
                let now = now_ms();
                let predicted = if np.playing { np.position_ms + now.saturating_sub(np.updated_at_ms) } else { np.position_ms };
                let seek = reported.is_some_and(|p| predicted.abs_diff(p) > 1500);
                if changed || t.playing != np.playing || seek {
                    np.position_ms = reported.unwrap_or(predicted);
                    np.playing = t.playing;
                    np.updated_at_ms = now;
                    changed = true;
                }
            }
            _ => {
                silent_rounds += 1;
                if silent_rounds == 20 {
                    log("Не вижу играющей музыки. Нужен плеер, который показывает трек в регуляторе громкости Windows".into());
                }
                // Players drop out of the list for a moment when switching tracks;
                // only take the lyrics away after five seconds of silence.
                if silent_rounds >= 10 {
                    if written {
                        lyrics::clear(&game_dir);
                        written = false;
                    }
                    np = NowPlaying::default();
                }
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
    // Windows' "current" session is often a paused player in the background
    // (say Spotify while Yandex Music plays), so prefer one that is playing.
    let is_playing = |s: &windows::Media::Control::GlobalSystemMediaTransportControlsSession| {
        s.GetPlaybackInfo().and_then(|i| i.PlaybackStatus()).map(|st| st == Status::Playing).unwrap_or(false)
    };
    let sessions = manager.GetSessions().ok()?;
    let session = (0..sessions.Size().unwrap_or(0))
        .filter_map(|i| sessions.GetAt(i).ok())
        .find(|s| is_playing(s))
        .or_else(|| manager.GetCurrentSession().ok())?;
    let app = session.SourceAppUserModelId().map(|a| a.to_string_lossy()).unwrap_or_default();
    let props = session.TryGetMediaPropertiesAsync().ok()?.join().ok()?;
    let title = props.Title().ok()?.to_string_lossy();
    let artist = props.Artist().map(|a| a.to_string_lossy()).unwrap_or_default();
    let playing = is_playing(&session);

    let timeline = session.GetTimelineProperties().ok()?;
    // TimeSpan and DateTime count 100 ns ticks; DateTime starts in 1601.
    let pos = timeline.Position().ok()?.Duration.max(0) as u64 / 10_000;
    let end = timeline.EndTime().ok().map(|e| e.Duration.max(0) as u64 / 10_000).filter(|&e| e > 0);
    let updated = timeline.LastUpdatedTime().ok()?.UniversalTime / 10_000 - 11_644_473_600_000;
    // A player without timeline support leaves both the position and the end at zero.
    let position_ms = if pos == 0 && end.is_none() {
        None
    } else if playing && updated > 0 {
        Some(pos + now_ms().saturating_sub(updated as u64))
    } else {
        Some(pos)
    };
    Some(Track { app, title, artist, playing, position_ms, duration_ms: end })
}

#[cfg(not(windows))]
fn current() -> Option<Track> {
    None
}
