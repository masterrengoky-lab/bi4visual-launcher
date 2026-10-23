//! Player skins: fetching the current skin for the launcher preview and
//! uploading a new one for Microsoft accounts.

use crate::accounts::{Account, AccountKind};
use crate::manifest::installed_versions;
use crate::paths::Paths;
use anyhow::{anyhow, bail, Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::io::Read;

#[derive(Debug, Clone, Serialize)]
pub struct Skin {
    /// PNG as a `data:` URL, ready for the 3D viewer.
    pub data_url: String,
    pub slim: bool,
}

fn data_url(png: &[u8]) -> String {
    format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png))
}

#[derive(Deserialize)]
struct SessionProfile {
    properties: Vec<Property>,
}

#[derive(Deserialize)]
struct Property {
    name: String,
    value: String,
}

#[derive(Deserialize)]
struct Textures {
    textures: TextureSet,
}

#[derive(Deserialize)]
struct TextureSet {
    #[serde(rename = "SKIN")]
    skin: Option<TextureRef>,
}

#[derive(Deserialize)]
struct TextureRef {
    url: String,
    #[serde(default)]
    metadata: Option<serde_json::Value>,
}

/// The skin of a licensed profile, from Mojang's session server.
async fn licensed_skin(client: &reqwest::Client, uuid: &str) -> Result<Option<Skin>> {
    let profile: SessionProfile =
        crate::download::get_json(client, &format!("https://sessionserver.mojang.com/session/minecraft/profile/{uuid}")).await?;
    let Some(prop) = profile.properties.iter().find(|p| p.name == "textures") else { return Ok(None) };
    let raw = base64::engine::general_purpose::STANDARD.decode(&prop.value)?;
    let textures: Textures = serde_json::from_slice(&raw)?;
    let Some(skin) = textures.textures.skin else { return Ok(None) };
    let slim = skin
        .metadata
        .as_ref()
        .and_then(|m| m["model"].as_str())
        .is_some_and(|m| m == "slim");
    let png = client.get(skin.url.replace("http://", "https://")).send().await?.error_for_status()?.bytes().await?;
    Ok(Some(Skin { data_url: data_url(&png), slim }))
}

/// Offline players see a default skin in game. Mojang picks it from the UUID:
/// before 1.19.3 even/odd hash meant Steve/Alex. We use the same rule so the
/// preview matches older versions and is stable for a nickname.
pub fn default_is_alex(uuid: &str) -> bool {
    let n = u128::from_str_radix(uuid, 16).unwrap_or(0);
    let (hi, lo) = ((n >> 64) as u64, n as u64);
    let h = (hi >> 32) ^ hi ^ (lo >> 32) ^ lo;
    (h as i32 & 1) == 1
}

/// Reads Steve or Alex from any installed client jar.
fn default_from_jar(paths: &Paths, alex: bool) -> Option<Skin> {
    let name = if alex { "alex" } else { "steve" };
    let candidates = [
        format!("assets/minecraft/textures/entity/player/{}/{name}.png", if alex { "slim" } else { "wide" }),
        format!("assets/minecraft/textures/entity/{name}.png"),
    ];
    for id in installed_versions(paths).iter().rev() {
        let Ok(file) = std::fs::File::open(paths.version_jar(id)) else { continue };
        let Ok(mut zip) = zip::ZipArchive::new(file) else { continue };
        for c in &candidates {
            if let Ok(mut entry) = zip.by_name(c) {
                let mut png = Vec::new();
                if entry.read_to_end(&mut png).is_ok() {
                    return Some(Skin { data_url: data_url(&png), slim: alex });
                }
            }
        }
    }
    None
}

/// Skin to show for an account. `None` means the UI should use its built-in placeholder.
pub async fn skin_for(client: &reqwest::Client, paths: &Paths, acc: &Account) -> Result<Option<Skin>> {
    if acc.kind == AccountKind::Microsoft {
        if let Ok(Some(s)) = licensed_skin(client, &acc.uuid).await {
            return Ok(Some(s));
        }
    }
    Ok(default_from_jar(paths, default_is_alex(&acc.uuid)))
}

/// Uploads a new skin for a Microsoft account.
pub async fn upload(client: &reqwest::Client, acc: &Account, png: Vec<u8>, slim: bool) -> Result<()> {
    if acc.kind != AccountKind::Microsoft {
        bail!("Сменить скин можно только у аккаунта Microsoft");
    }
    validate_png(&png)?;
    let token = acc.access_token.as_deref().ok_or_else(|| anyhow!("Войдите в аккаунт заново"))?;
    let part = reqwest::multipart::Part::bytes(png).file_name("skin.png").mime_str("image/png")?;
    let form = reqwest::multipart::Form::new()
        .text("variant", if slim { "slim" } else { "classic" })
        .part("file", part);
    client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await?
        .error_for_status()
        .context("Mojang не принял скин")?;
    Ok(())
}

/// Skins are 64x64 (or legacy 64x32) PNG files.
pub fn validate_png(png: &[u8]) -> Result<()> {
    if png.len() < 24 || &png[..8] != b"\x89PNG\r\n\x1a\n" || &png[12..16] != b"IHDR" {
        bail!("Это не PNG-файл");
    }
    let w = u32::from_be_bytes(png[16..20].try_into()?);
    let h = u32::from_be_bytes(png[20..24].try_into()?);
    if !(w == 64 && (h == 64 || h == 32)) {
        bail!("Скин должен быть 64×64 пикселя, а этот {w}×{h}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png_header(w: u32, h: u32) -> Vec<u8> {
        let mut v = b"\x89PNG\r\n\x1a\n\0\0\0\x0dIHDR".to_vec();
        v.extend(w.to_be_bytes());
        v.extend(h.to_be_bytes());
        v
    }

    #[test]
    fn validates_size() {
        assert!(validate_png(&png_header(64, 64)).is_ok());
        assert!(validate_png(&png_header(64, 32)).is_ok());
        assert!(validate_png(&png_header(128, 128)).is_err());
        assert!(validate_png(b"not a png at all, nope!!").is_err());
    }

    #[test]
    fn default_skin_is_stable() {
        let u = crate::accounts::offline_uuid("Notch");
        assert_eq!(default_is_alex(&u), default_is_alex(&u));
    }
}
