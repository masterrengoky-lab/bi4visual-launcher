//! Forge and NeoForge. Both need their official installer to run (it patches
//! the game jar), so we download the installer and run it headless against our
//! data folder, which has the same layout as `.minecraft`.

use crate::download::{self, Job};
use crate::manifest::installed_versions;
use crate::paths::Paths;
use crate::{Progress, ProgressFn};
use anyhow::{anyhow, bail, Result};
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Flavor {
    Forge,
    NeoForge,
}

const FORGE_MAVEN: &str = "https://maven.minecraftforge.net/net/minecraftforge/forge";
const NEO_MAVEN: &str = "https://maven.neoforged.net/releases/net/neoforged/neoforge";

/// NeoForge numbers versions after the game: 1.21.1 → 21.1.x, 1.21 → 21.0.x.
pub fn neoforge_prefix(game: &str) -> Option<String> {
    let mut parts = game.strip_prefix("1.")?.split('.');
    let major = parts.next()?;
    let minor = parts.next().unwrap_or("0");
    Some(format!("{major}.{minor}."))
}

/// Pulls `<version>` values out of a maven-metadata.xml.
fn maven_versions(xml: &str) -> Vec<String> {
    xml.split("<version>")
        .skip(1)
        .filter_map(|s| s.split("</version>").next())
        .map(|s| s.trim().to_string())
        .collect()
}

/// Loader versions for a game version, newest first.
/// For Forge the values are full `<game>-<forge>` coordinates.
pub async fn versions(client: &reqwest::Client, flavor: Flavor, game: &str) -> Result<Vec<String>> {
    match flavor {
        Flavor::Forge => {
            let xml = client.get(format!("{FORGE_MAVEN}/maven-metadata.xml")).send().await?.error_for_status()?.text().await?;
            let prefix = format!("{game}-");
            let mut v: Vec<String> = maven_versions(&xml).into_iter().filter(|v| v.starts_with(&prefix)).collect();
            v.reverse();
            Ok(v)
        }
        Flavor::NeoForge => {
            let Some(prefix) = neoforge_prefix(game) else { return Ok(vec![]) };
            #[derive(serde::Deserialize)]
            struct List {
                versions: Vec<String>,
            }
            let list: List = download::get_json(
                client,
                "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge",
            )
            .await?;
            let mut v: Vec<String> = list.versions.into_iter().filter(|v| v.starts_with(&prefix)).collect();
            v.reverse();
            Ok(v)
        }
    }
}

fn installer_url(flavor: Flavor, version: &str) -> String {
    match flavor {
        Flavor::Forge => format!("{FORGE_MAVEN}/{version}/forge-{version}-installer.jar"),
        Flavor::NeoForge => format!("{NEO_MAVEN}/{version}/neoforge-{version}-installer.jar"),
    }
}

/// Runs the installer and returns the id of the version it created.
/// The vanilla version must already be installed.
pub async fn install(
    client: &reqwest::Client,
    paths: &Paths,
    flavor: Flavor,
    version: &str,
    java: &Path,
    progress: &ProgressFn,
) -> Result<String> {
    progress(Progress { stage: "loader".into(), done: 0, total: 1 });
    // The installer refuses to run without this file.
    let profiles = paths.root.join("launcher_profiles.json");
    if !profiles.exists() {
        std::fs::write(&profiles, r#"{"profiles":{}}"#)?;
    }
    let installer = paths.root.join("installers").join(format!("{flavor:?}-{version}-installer.jar").to_lowercase());
    download::fetch(client, &Job { url: installer_url(flavor, version), dest: installer.clone(), sha1: None }).await?;

    let before = installed_versions(paths);
    let mut cmd = tokio::process::Command::new(java);
    cmd.arg("-jar").arg(&installer).arg("--installClient").arg(&paths.root).current_dir(&paths.root);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    let out = cmd.output().await.map_err(|e| anyhow!("не удалось запустить установщик: {e}"))?;
    let _ = std::fs::remove_file(&installer);
    if !out.status.success() {
        let log = String::from_utf8_lossy(&out.stdout);
        let tail: Vec<&str> = log.lines().rev().take(8).collect();
        bail!(
            "Установщик {flavor:?} завершился с ошибкой:\n{}",
            tail.into_iter().rev().collect::<Vec<_>>().join("\n")
        );
    }
    progress(Progress { stage: "loader".into(), done: 1, total: 1 });

    let after = installed_versions(paths);
    let short = version.rsplit('-').next().unwrap_or(version);
    after
        .iter()
        .find(|id| !before.contains(id))
        .or_else(|| after.iter().find(|id| id.to_lowercase().contains("forge") && id.contains(short)))
        .cloned()
        .ok_or_else(|| anyhow!("установщик не создал версию"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn neoforge_prefixes() {
        assert_eq!(neoforge_prefix("1.21.1").unwrap(), "21.1.");
        assert_eq!(neoforge_prefix("1.21").unwrap(), "21.0.");
        assert!(neoforge_prefix("24w10a").is_none());
    }

    #[test]
    fn parses_maven_metadata() {
        let xml = "<metadata><versioning><versions><version>1.20.1-47.2.0</version>\n<version>1.20.1-47.3.0</version></versions></versioning></metadata>";
        assert_eq!(maven_versions(xml), vec!["1.20.1-47.2.0", "1.20.1-47.3.0"]);
    }
}
