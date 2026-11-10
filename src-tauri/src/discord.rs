//! Discord status ("Играет в …") straight over Discord's local IPC pipe.
//!
//! The big title of the card is the name of the Discord application whose id
//! is in the settings; the lines under it, the picture, the timer and up to two
//! buttons come from the settings too. A thread re-reads the settings every few
//! seconds, so changes show up without a restart.

use bi4visual_core::{paths::Paths, settings::Settings};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// When the running game started (unix seconds), 0 while no game runs.
pub static GAME_STARTED: AtomicU64 = AtomicU64::new(0);

pub fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[cfg(windows)]
type Pipe = std::fs::File;
#[cfg(unix)]
type Pipe = std::os::unix::net::UnixStream;

fn open_pipe() -> Option<Pipe> {
    for i in 0..10 {
        #[cfg(windows)]
        {
            let path = format!(r"\\?\pipe\discord-ipc-{i}");
            if let Ok(f) = std::fs::OpenOptions::new().read(true).write(true).open(path) {
                return Some(f);
            }
        }
        #[cfg(unix)]
        {
            let dir = std::env::var("XDG_RUNTIME_DIR")
                .or_else(|_| std::env::var("TMPDIR"))
                .unwrap_or_else(|_| "/tmp".into());
            if let Ok(s) = std::os::unix::net::UnixStream::connect(format!("{dir}/discord-ipc-{i}")) {
                return Some(s);
            }
        }
    }
    None
}

/// One message of the IPC protocol: opcode, length, JSON, little endian.
pub fn frame(op: u32, body: &Value) -> Vec<u8> {
    let data = body.to_string().into_bytes();
    let mut out = Vec::with_capacity(8 + data.len());
    out.extend_from_slice(&op.to_le_bytes());
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(&data);
    out
}

fn send(pipe: &mut Pipe, op: u32, body: &Value) -> std::io::Result<Value> {
    pipe.write_all(&frame(op, body))?;
    pipe.flush()?;
    let mut head = [0u8; 8];
    pipe.read_exact(&mut head)?;
    let len = u32::from_le_bytes([head[4], head[5], head[6], head[7]]) as usize;
    let mut data = vec![0u8; len.min(1 << 20)];
    pipe.read_exact(&mut data)?;
    let reply: Value = serde_json::from_slice(&data).unwrap_or(Value::Null);
    let op = u32::from_le_bytes([head[0], head[1], head[2], head[3]]);
    if op == 2 {
        return Err(std::io::Error::other("Discord closed the connection"));
    }
    Ok(reply)
}

/// The activity Discord shows, from the settings; `start` is the timer's start.
pub fn activity(s: &Settings, start: u64) -> Value {
    let mut a = serde_json::Map::new();
    let text = |v: &str| v.trim().chars().take(128).collect::<String>();
    if text(&s.discord_details).len() >= 2 {
        a.insert("details".into(), json!(text(&s.discord_details)));
    }
    if text(&s.discord_state).len() >= 2 {
        a.insert("state".into(), json!(text(&s.discord_state)));
    }
    a.insert("timestamps".into(), json!({ "start": start }));
    if !s.discord_image.trim().is_empty() {
        a.insert("assets".into(), json!({ "large_image": s.discord_image.trim(), "large_text": "NovaVis" }));
    }
    let buttons: Vec<Value> = [(&s.discord_button1, &s.discord_url1), (&s.discord_button2, &s.discord_url2)]
        .into_iter()
        .filter(|(l, u)| !l.trim().is_empty() && (u.starts_with("https://") || u.starts_with("http://")))
        .map(|(l, u)| json!({ "label": l.trim().chars().take(32).collect::<String>(), "url": u.trim() }))
        .collect();
    if !buttons.is_empty() {
        a.insert("buttons".into(), Value::Array(buttons));
    }
    Value::Object(a)
}

/// Runs for the whole life of the launcher.
pub fn spawn(paths: Paths) {
    std::thread::spawn(move || {
        let launcher_start = now_secs();
        let mut pipe: Option<(Pipe, String)> = None;
        let mut shown = String::new();
        let mut nonce = 0u64;
        loop {
            let s = Settings::load(&paths);
            let id = s.discord_app_id.trim().to_string();
            let on = s.discord_rpc && id.len() >= 15 && id.chars().all(|c| c.is_ascii_digit());
            if !on || pipe.as_ref().is_some_and(|(_, old)| *old != id) {
                pipe = None; // dropping the pipe clears the status
                shown.clear();
            }
            if on {
                if pipe.is_none() {
                    if let Some(mut p) = open_pipe() {
                        if send(&mut p, 0, &json!({ "v": 1, "client_id": id })).is_ok() {
                            pipe = Some((p, id.clone()));
                        }
                    }
                }
                if let Some((p, _)) = pipe.as_mut() {
                    let game = GAME_STARTED.load(Ordering::Relaxed);
                    let act = activity(&s, if game > 0 { game } else { launcher_start });
                    let key = act.to_string();
                    if key != shown {
                        nonce += 1;
                        let msg = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": { "pid": std::process::id(), "activity": act },
                            "nonce": nonce.to_string(),
                        });
                        match send(p, 1, &msg) {
                            Ok(_) => shown = key,
                            Err(_) => {
                                pipe = None;
                                shown.clear();
                            }
                        }
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(4));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_layout() {
        let f = frame(1, &json!({ "a": 1 }));
        assert_eq!(&f[0..4], &1u32.to_le_bytes());
        assert_eq!(&f[4..8], &7u32.to_le_bytes());
        assert_eq!(&f[8..], br#"{"a":1}"#);
    }

    #[test]
    fn buttons_need_a_link() {
        let mut s = Settings::default();
        s.discord_url1 = "https://t.me/x".into();
        s.discord_url2 = String::new();
        let a = activity(&s, 5);
        assert_eq!(a["buttons"].as_array().unwrap().len(), 1);
        assert_eq!(a["timestamps"]["start"], 5);
        assert_eq!(a["details"], "Yeban Client");
    }
}
