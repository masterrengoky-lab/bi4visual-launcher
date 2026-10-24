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

/// Where an offline account's own skin is kept.
pub fn custom_path(paths: &Paths, account_id: &str) -> std::path::PathBuf {
    paths.root.join("skins").join(format!("{account_id}.png"))
}

/// Saves a skin for an offline account. The caller stores `custom_skin_slim`.
pub fn save_custom(paths: &Paths, acc: &Account, png: &[u8]) -> Result<()> {
    if acc.kind != AccountKind::Offline {
        bail!("Свой файл скина ставится только аккаунту без пароля");
    }
    validate_png(png)?;
    let p = custom_path(paths, &acc.id);
    crate::paths::ensure_parent(&p)?;
    std::fs::write(p, png)?;
    Ok(())
}

pub fn remove_custom(paths: &Paths, acc: &Account) {
    let _ = std::fs::remove_file(custom_path(paths, &acc.id));
}

const PACK_DIR: &str = "bi4visual-skin";
const PACK_ID: &str = "file/bi4visual-skin";

/// Default skin textures in every Minecraft version, wide and slim.
fn default_texture_paths() -> Vec<String> {
    let mut v = vec!["assets/minecraft/textures/entity/steve.png".to_string(), "assets/minecraft/textures/entity/alex.png".to_string()];
    for name in ["steve", "alex", "ari", "efe", "kai", "makena", "noor", "sunny", "zuri"] {
        for model in ["wide", "slim"] {
            v.push(format!("assets/minecraft/textures/entity/player/{model}/{name}.png"));
        }
    }
    v
}

/// An offline player's own skin cannot come from Mojang, so we put it into a
/// small resource pack that replaces the default skins. Only this player sees
/// it, and other players with default skins look the same on their screen.
/// For other accounts the pack is removed again.
pub fn apply_pack(paths: &Paths, acc: &Account, game_dir: &std::path::Path) -> Result<()> {
    let pack = game_dir.join("resourcepacks").join(PACK_DIR);
    let custom = custom_path(paths, &acc.id);
    let enable = acc.kind == AccountKind::Offline && acc.custom_skin_slim.is_some() && custom.is_file();
    let _ = std::fs::remove_dir_all(&pack);
    if enable {
        let png = std::fs::read(&custom)?;
        for rel in default_texture_paths() {
            let dest = pack.join(rel);
            crate::paths::ensure_parent(&dest)?;
            std::fs::write(dest, &png)?;
        }
        std::fs::write(
            pack.join("pack.mcmeta"),
            r#"{"pack":{"pack_format":15,"supported_formats":[1,99],"description":"Скин из bi4visual launcher"}}"#,
        )?;
    }
    set_pack_enabled(&game_dir.join("options.txt"), PACK_ID, enable)
}

/// Adds or removes a pack in the `resourcePacks:[...]` line of options.txt.
pub(crate) fn set_pack_enabled(options: &std::path::Path, pack_id: &str, enable: bool) -> Result<()> {
    let text = std::fs::read_to_string(options).unwrap_or_default();
    let mut found = false;
    let mut lines: Vec<String> = text
        .lines()
        .map(|line| {
            let Some(list) = line.strip_prefix("resourcePacks:") else { return line.to_string() };
            found = true;
            let mut packs: Vec<String> = serde_json::from_str(list).unwrap_or_else(|_| vec!["vanilla".into()]);
            packs.retain(|p| p != pack_id);
            if enable {
                packs.push(pack_id.into());
            }
            format!("resourcePacks:{}", serde_json::to_string(&packs).unwrap_or_default())
        })
        .collect();
    if !found {
        if !enable {
            return Ok(());
        }
        lines.push(format!("resourcePacks:[\"vanilla\",\"{pack_id}\"]"));
    }
    crate::paths::ensure_parent(options)?;
    std::fs::write(options, lines.join("\n") + "\n")?;
    Ok(())
}

/// Skin to show for an account. `None` means the UI should use its built-in placeholder.
pub async fn skin_for(client: &reqwest::Client, paths: &Paths, acc: &Account) -> Result<Option<Skin>> {
    if let (AccountKind::Offline, Some(slim)) = (&acc.kind, acc.custom_skin_slim) {
        if let Ok(png) = std::fs::read(custom_path(paths, &acc.id)) {
            return Ok(Some(Skin { data_url: data_url(&png), slim }));
        }
    }
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
    fn offline_skin_pack() {
        let tmp = tempfile::tempdir().unwrap();
        let paths = Paths::new(tmp.path());
        let game = tmp.path().join("game");
        let mut acc = crate::accounts::offline("Alex").unwrap();
        let mut png = png_header(64, 64);
        png.extend([0u8; 16]);
        save_custom(&paths, &acc, &png).unwrap();
        acc.custom_skin_slim = Some(true);
        std::fs::create_dir_all(&game).unwrap();
        std::fs::write(game.join("options.txt"), "fov:0.0\nresourcePacks:[\"vanilla\"]\n").unwrap();

        apply_pack(&paths, &acc, &game).unwrap();
        let opts = std::fs::read_to_string(game.join("options.txt")).unwrap();
        assert!(opts.contains(r#"resourcePacks:["vanilla","file/bi4visual-skin"]"#));
        assert!(opts.contains("fov:0.0"));
        assert!(game.join("resourcepacks/bi4visual-skin/assets/minecraft/textures/entity/player/wide/steve.png").exists());

        acc.custom_skin_slim = None;
        apply_pack(&paths, &acc, &game).unwrap();
        let opts = std::fs::read_to_string(game.join("options.txt")).unwrap();
        assert!(opts.contains(r#"resourcePacks:["vanilla"]"#));
        assert!(!game.join("resourcepacks/bi4visual-skin").exists());
    }

    #[test]
    fn default_skin_is_stable() {
        let u = crate::accounts::offline_uuid("Notch");
        assert_eq!(default_is_alex(&u), default_is_alex(&u));
    }
}
