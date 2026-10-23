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
        }
    }
}

impl Settings {
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
