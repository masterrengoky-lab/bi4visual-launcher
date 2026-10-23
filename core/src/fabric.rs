//! Fabric loader: lists loader versions and installs a profile that inherits from vanilla.

use crate::download::get_json;
use crate::manifest::VersionJson;
use crate::paths::{ensure_parent, Paths};
use anyhow::Result;
use serde::Deserialize;

const META: &str = "https://meta.fabricmc.net/v2";

#[derive(Debug, Deserialize)]
struct LoaderEntry {
    loader: LoaderInfo,
}

#[derive(Debug, Deserialize)]
struct LoaderInfo {
    version: String,
    stable: bool,
}

/// Loader versions available for a game version, newest first, stable ones first.
pub async fn loader_versions(client: &reqwest::Client, game: &str) -> Result<Vec<String>> {
    let list: Vec<LoaderEntry> = get_json(client, &format!("{META}/versions/loader/{game}")).await?;
    let (stable, other): (Vec<_>, Vec<_>) = list.into_iter().partition(|e| e.loader.stable);
    Ok(stable.into_iter().chain(other).map(|e| e.loader.version).collect())
}

/// Writes the Fabric profile JSON and returns its version id.
/// The actual files are downloaded by [`crate::install::install`].
pub async fn install_profile(client: &reqwest::Client, paths: &Paths, game: &str, loader: &str) -> Result<String> {
    let url = format!("{META}/versions/loader/{game}/{loader}/profile/json");
    let profile: VersionJson = get_json(client, &url).await?;
    let id = profile.id.clone();
    let dest = paths.version_json(&id);
    ensure_parent(&dest)?;
    std::fs::write(&dest, serde_json::to_vec_pretty(&profile)?)?;
    Ok(id)
}
