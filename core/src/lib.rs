//! Core of KissLauncherVis: downloading Minecraft, Java and loaders,
//! managing accounts and building the game command line.
//! Has no UI dependencies so it can be tested on its own.

pub mod accounts;
pub mod backgrounds;
pub mod curseforge;
pub mod download;
pub mod fabric;
pub mod forge;
pub mod friends;
pub mod install;
pub mod instances;
pub mod java;
pub mod launch;
pub mod lyrics;
pub mod manifest;
pub mod microsoft;
pub mod modrinth;
pub mod paths;
pub mod resourcepacks;
pub mod rules;
pub mod settings;
pub mod skin_library;
pub mod skins;

pub const LAUNCHER_NAME: &str = "KissLauncherVis";
pub const LAUNCHER_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Progress of a long operation, reported to the UI.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Progress {
    pub stage: String,
    pub done: u64,
    pub total: u64,
}

pub type ProgressFn = std::sync::Arc<dyn Fn(Progress) + Send + Sync>;

pub fn no_progress() -> ProgressFn {
    std::sync::Arc::new(|_| {})
}
