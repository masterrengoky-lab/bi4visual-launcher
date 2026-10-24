//! Launcher settings saved in `settings.json`.

use crate::paths::Paths;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Max Java heap in megabytes.
    pub memory_mb: u32,
    /// Own Java instead of the downloaded one.
    pub java_path: Option<String>,
    pub extra_jvm_args: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fullscreen: bool,
    /// Hide the launcher window while the game runs.
    pub hide_on_launch: bool,
    /// Instance started by the Play button.
    pub selected_instance: Option<String>,
    pub show_snapshots: bool,
    /// File name of the custom background in `<root>/backgrounds`.
    pub background: Option<String>,
    /// How much the background is darkened, 0–90 %.
    pub bg_dim: u8,
    /// Background blur in pixels, 0–20.
    pub bg_blur: u8,
    pub particles: bool,
    /// Cosmetics worn by the model in the launcher.
    pub cosmetics: Vec<String>,
    /// Song lyrics in the world while music plays (needs a Fabric instance).
    pub lyrics: bool,
    /// Sky drawn by the mod: "galaxy", "aurora", "both" or "off".
    pub sky: String,
    /// Keep the game at night on the player's side.
    pub always_night: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            memory_mb: 4096,
            java_path: None,
            extra_jvm_args: String::new(),
            width: None,
            height: None,
            fullscreen: false,
            hide_on_launch: true,
            selected_instance: None,
            show_snapshots: false,
            background: None,
            bg_dim: 45,
            bg_blur: 3,
            particles: true,
            cosmetics: Vec::new(),
            lyrics: true,
            sky: "galaxy".into(),
            always_night: true,
        }
    }
}

impl Settings {
    /// Whether anything needs the bi4visual mod in the game.
    pub fn wants_mod(&self) -> bool {
        self.lyrics || self.sky != "off" || self.always_night
    }

    pub fn load(paths: &Paths) -> Self {
        std::fs::read_to_string(paths.settings_file())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, paths: &Paths) -> Result<()> {
        crate::paths::ensure_parent(&paths.settings_file())?;
        std::fs::write(paths.settings_file(), serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }
}
