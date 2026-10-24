//! Sword cosmetics from a resource pack the player brings. The launcher never
//! ships these models: the player drops a zip into `<root>/cosmetics`, we pick
//! out the sword item definitions with the models and textures they use, and
//! turn them into a small resource pack that only this player's game loads.
//! The in-game menu then lists the names, and the mod shows the chosen model
//! in the player's hands.

use crate::paths::Paths;
use anyhow::{bail, Context, Result};
use std::collections::BTreeSet;
use std::io::Read;
use std::path::{Path, PathBuf};

const PACK_DIR: &str = "bi4visual-cosmetics";
const PACK_ID: &str = "file/bi4visual-cosmetics";

pub fn dir(paths: &Paths) -> PathBuf {
    paths.root.join("cosmetics")
}

fn pack(paths: &Paths) -> PathBuf {
    dir(paths).join("pack")
}

fn names_file(paths: &Paths) -> PathBuf {
    dir(paths).join("names.json")
}

/// Names of the imported cosmetics, in the pack's order.
pub fn names(paths: &Paths) -> Vec<String> {
    std::fs::read_to_string(names_file(paths)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

/// Imports the newest zip in the cosmetics folder. Returns how many cosmetics it has.
pub fn import(paths: &Paths) -> Result<usize> {
    let folder = dir(paths);
    std::fs::create_dir_all(&folder)?;
    let zip_path = std::fs::read_dir(&folder)?
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("zip")))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .map(|e| e.path())
        .context("Положи zip с косметикой в папку косметики и нажми ещё раз")?;
    import_zip(&zip_path, &pack(paths), &names_file(paths))
}

fn read_entry(zip: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Option<Vec<u8>> {
    let mut f = zip.by_name(name).ok()?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    Some(buf)
}

/// "minecraft:item/x" or "item/x" to "item/x".
fn bare(id: &str) -> &str {
    id.strip_prefix("minecraft:").unwrap_or(id)
}

pub fn import_zip(zip_path: &Path, out: &Path, names_out: &Path) -> Result<usize> {
    let file = std::fs::File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file).context("Это не zip-архив")?;
    let all: Vec<String> = zip.file_names().map(String::from).collect();
    // The pack may sit inside folders (a project, a "resources" dir): find where assets/ starts.
    let marker = "assets/minecraft/items/";
    let items: Vec<String> = all
        .iter()
        .filter(|n| n.contains(marker) && n.ends_with("_sword.json") && !n.contains("/build/"))
        .cloned()
        .collect();
    let Some(first) = items.first() else {
        bail!("В архиве нет моделей мечей (assets/minecraft/items/*_sword.json)");
    };
    let prefix = first[..first.find(marker).unwrap()].to_string();
    let items: Vec<String> = items.into_iter().filter(|n| n.starts_with(&prefix)).collect();

    let _ = std::fs::remove_dir_all(out);
    let mut names: Vec<String> = Vec::new();
    let mut models: BTreeSet<String> = BTreeSet::new();
    for item in &items {
        let Some(bytes) = read_entry(&mut zip, item) else { continue };
        let json: serde_json::Value = serde_json::from_slice(&bytes).with_context(|| format!("Не читается {item}"))?;
        if let Some(cases) = json.pointer("/model/cases").and_then(|c| c.as_array()) {
            for case in cases {
                let when: Vec<String> = match &case["when"] {
                    serde_json::Value::String(s) => vec![s.clone()],
                    serde_json::Value::Array(a) => a.iter().filter_map(|v| v.as_str().map(String::from)).collect(),
                    _ => vec![],
                };
                for w in when {
                    if !names.contains(&w) {
                        names.push(w);
                    }
                }
                if let Some(m) = case.pointer("/model/model").and_then(|m| m.as_str()) {
                    models.insert(bare(m).to_string());
                }
            }
        }
        let dest = out.join(&item[prefix.len()..]);
        crate::paths::ensure_parent(&dest)?;
        std::fs::write(dest, &bytes)?;
    }

    // Models, the models they build on, and their textures.
    let mut textures: BTreeSet<String> = BTreeSet::new();
    let mut queue: Vec<String> = models.into_iter().collect();
    let mut seen: BTreeSet<String> = BTreeSet::new();
    while let Some(model) = queue.pop() {
        if !seen.insert(model.clone()) {
            continue;
        }
        let name = format!("{prefix}assets/minecraft/models/{model}.json");
        let Some(bytes) = read_entry(&mut zip, &name) else { continue };
        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&bytes) {
            if let Some(map) = json["textures"].as_object() {
                for v in map.values().filter_map(|v| v.as_str()) {
                    if !v.starts_with('#') {
                        textures.insert(bare(v).to_string());
                    }
                }
            }
            if let Some(parent) = json["parent"].as_str() {
                queue.push(bare(parent).to_string());
            }
        }
        let dest = out.join(format!("assets/minecraft/models/{model}.json"));
        crate::paths::ensure_parent(&dest)?;
        std::fs::write(dest, &bytes)?;
    }
    for tex in textures {
        for ext in ["png", "png.mcmeta"] {
            let name = format!("{prefix}assets/minecraft/textures/{tex}.{ext}");
            if let Some(bytes) = read_entry(&mut zip, &name) {
                let dest = out.join(format!("assets/minecraft/textures/{tex}.{ext}"));
                crate::paths::ensure_parent(&dest)?;
                std::fs::write(dest, bytes)?;
            }
        }
    }
    std::fs::write(
        out.join("pack.mcmeta"),
        r#"{"pack":{"pack_format":46,"supported_formats":[46,999],"min_format":46,"max_format":999,"description":"Косметика bi4visual"}}"#,
    )?;
    std::fs::write(names_out, serde_json::to_string_pretty(&names)?)?;
    Ok(names.len())
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)?.flatten() {
        let p = e.path();
        let dest = to.join(e.file_name());
        if p.is_dir() {
            copy_dir(&p, &dest)?;
        } else {
            std::fs::copy(&p, &dest)?;
        }
    }
    Ok(())
}

/// Puts the imported pack into an instance and turns it on, or takes it out
/// when nothing is imported. The mod reads the names from bi4visual/cosmetics.json.
pub fn apply(paths: &Paths, game_dir: &Path) -> Result<()> {
    let src = pack(paths);
    let dest = game_dir.join("resourcepacks").join(PACK_DIR);
    let names_dest = game_dir.join("bi4visual").join("cosmetics.json");
    let enable = src.join("pack.mcmeta").is_file();
    if enable {
        let new = std::fs::read_to_string(names_file(paths)).unwrap_or_default();
        let old = std::fs::read_to_string(&names_dest).unwrap_or_default();
        if new != old || !dest.is_dir() {
            let _ = std::fs::remove_dir_all(&dest);
            copy_dir(&src, &dest)?;
            crate::paths::ensure_parent(&names_dest)?;
            std::fs::write(&names_dest, new)?;
        }
    } else {
        let _ = std::fs::remove_dir_all(&dest);
        let _ = std::fs::remove_file(&names_dest);
    }
    crate::skins::set_pack_enabled(&game_dir.join("options.txt"), PACK_ID, enable)
}

/// Removes the imported cosmetics (the zip the player put there stays).
pub fn clear(paths: &Paths) -> Result<()> {
    let _ = std::fs::remove_dir_all(pack(paths));
    let _ = std::fs::remove_file(names_file(paths));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn imports_swords_with_models_and_textures() {
        let tmp = std::env::temp_dir().join(format!("b4-cos-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let zip_path = tmp.join("pack.zip");
        {
            let mut w = zip::ZipWriter::new(std::fs::File::create(&zip_path).unwrap());
            let opt: zip::write::SimpleFileOptions = Default::default();
            let base = "Proj/src/main/resources/assets/minecraft/";
            w.start_file(format!("{base}items/diamond_sword.json"), opt).unwrap();
            w.write_all(br#"{"model":{"type":"minecraft:select","property":"minecraft:custom_model_data","cases":[{"when":"Frost Sabre","model":{"type":"minecraft:model","model":"minecraft:item/frost"}}],"fallback":{"type":"minecraft:model","model":"minecraft:item/diamond_sword"}}}"#).unwrap();
            w.start_file(format!("{base}models/item/frost.json"), opt).unwrap();
            w.write_all(br#"{"textures":{"0":"item/frost_tex","particle":"item/frost_tex"},"elements":[]}"#).unwrap();
            w.start_file(format!("{base}textures/item/frost_tex.png"), opt).unwrap();
            w.write_all(b"png").unwrap();
            w.start_file(format!("{base}textures/item/unused.png"), opt).unwrap();
            w.write_all(b"png").unwrap();
            w.finish().unwrap();
        }
        let out = tmp.join("out");
        let n = import_zip(&zip_path, &out, &tmp.join("names.json")).unwrap();
        assert_eq!(n, 1);
        assert!(out.join("assets/minecraft/items/diamond_sword.json").is_file());
        assert!(out.join("assets/minecraft/models/item/frost.json").is_file());
        assert!(out.join("assets/minecraft/textures/item/frost_tex.png").is_file());
        assert!(!out.join("assets/minecraft/textures/item/unused.png").exists());
        let names: Vec<String> = serde_json::from_str(&std::fs::read_to_string(tmp.join("names.json")).unwrap()).unwrap();
        assert_eq!(names, vec!["Frost Sabre".to_string()]);
        let _ = std::fs::remove_dir_all(&tmp);
    }
}

