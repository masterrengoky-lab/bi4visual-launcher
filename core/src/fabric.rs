//! Fabric and Quilt: both publish ready launcher profiles that inherit from vanilla.

use crate::download::get_json;
use crate::manifest::VersionJson;
use crate::paths::{ensure_parent, Paths};
use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Copy)]
pub enum Flavor {
    Fabric,
    Quilt,
}

impl Flavor {
    fn meta(self) -> &'static str {
        match self {
            Flavor::Fabric => "https://meta.fabricmc.net/v2",
            Flavor::Quilt => "https://meta.quiltmc.org/v3",
        }
    }
}

#[derive(Debug, Deserialize)]
struct LoaderEntry {
    loader: LoaderInfo,
}

#[derive(Debug, Deserialize)]
struct LoaderInfo {
    version: String,
    /// Fabric marks stable builds; Quilt does not, but betas have "beta" in the name.
    #[serde(default)]
    stable: Option<bool>,
}

impl LoaderInfo {
    fn is_stable(&self) -> bool {
        self.stable.unwrap_or_else(|| !self.version.contains("beta") && !self.version.contains("pre"))
    }
}

/// Loader versions available for a game version, stable ones first.
pub async fn loader_versions(client: &reqwest::Client, flavor: Flavor, game: &str) -> Result<Vec<String>> {
    let list: Vec<LoaderEntry> = get_json(client, &format!("{}/versions/loader/{game}", flavor.meta())).await?;
    let (stable, other): (Vec<_>, Vec<_>) = list.into_iter().partition(|e| e.loader.is_stable());
    Ok(stable.into_iter().chain(other).map(|e| e.loader.version).collect())
}

/// Writes the loader profile JSON and returns its version id.
/// The actual files are downloaded by [`crate::install::install`].
pub async fn install_profile(client: &reqwest::Client, paths: &Paths, flavor: Flavor, game: &str, loader: &str) -> Result<String> {
    let url = format!("{}/versions/loader/{game}/{loader}/profile/json", flavor.meta());
    let profile: VersionJson = get_json(client, &url).await?;
    let id = profile.id.clone();
    let dest = paths.version_json(&id);
    ensure_parent(&dest)?;
    std::fs::write(&dest, serde_json::to_vec_pretty(&profile)?)?;
    Ok(id)
}
