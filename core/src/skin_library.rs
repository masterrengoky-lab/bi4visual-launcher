//! Saved skins ("Мои скины"): PNG files the player uploaded or took from a
//! nickname, ready to put on any account in one click.

use crate::paths::Paths;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub name: String,
    pub slim: bool,
    pub added: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntryView {
    #[serde(flatten)]
    pub entry: Entry,
    pub data_url: String,
}

fn dir(paths: &Paths) -> std::path::PathBuf {
    paths.root.join("skins").join("library")
}

fn index(paths: &Paths) -> std::path::PathBuf {
    dir(paths).join("index.json")
}

fn load(paths: &Paths) -> Vec<Entry> {
    std::fs::read_to_string(index(paths)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

fn save(paths: &Paths, list: &[Entry]) -> Result<()> {
    std::fs::create_dir_all(dir(paths))?;
    std::fs::write(index(paths), serde_json::to_vec_pretty(list)?)?;
    Ok(())
}

pub fn png_path(paths: &Paths, id: &str) -> std::path::PathBuf {
    dir(paths).join(format!("{id}.png"))
}

pub fn list(paths: &Paths) -> Vec<EntryView> {
    load(paths)
        .into_iter()
        .rev()
        .filter_map(|e| {
            let png = std::fs::read(png_path(paths, &e.id)).ok()?;
            Some(EntryView { data_url: crate::skins::data_url(&png), entry: e })
        })
        .collect()
}

pub fn add(paths: &Paths, name: &str, png: &[u8], slim: bool) -> Result<Entry> {
    crate::skins::validate_png(png)?;
    let mut all = load(paths);
    let id = uuid::Uuid::new_v4().simple().to_string();
    std::fs::create_dir_all(dir(paths))?;
    std::fs::write(png_path(paths, &id), png)?;
    let e = Entry { id, name: name.trim().chars().take(32).collect(), slim, added: crate::instances::now() };
    all.push(e.clone());
    save(paths, &all)?;
    Ok(e)
}

pub fn get(paths: &Paths, id: &str) -> Result<(Entry, Vec<u8>)> {
    let e = load(paths).into_iter().find(|e| e.id == id).ok_or_else(|| anyhow!("Скин не найден"))?;
    let png = std::fs::read(png_path(paths, id))?;
    Ok((e, png))
}

pub fn remove(paths: &Paths, id: &str) -> Result<()> {
    let mut all = load(paths);
    if !all.iter().any(|e| e.id == id) {
        return Ok(());
    }
    all.retain(|e| e.id != id);
    let _ = std::fs::remove_file(png_path(paths, id));
    save(paths, &all)
}
