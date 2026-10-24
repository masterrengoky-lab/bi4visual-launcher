//! Friends list kept on this computer. Licensed nicknames get their UUID so
//! the launcher can show their face.

use crate::paths::Paths;
use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Friend {
    pub name: String,
    /// Mojang UUID if the nickname is licensed.
    #[serde(default)]
    pub uuid: Option<String>,
    #[serde(default)]
    pub note: String,
    pub added: u64,
}

fn file(paths: &Paths) -> std::path::PathBuf {
    paths.root.join("friends.json")
}

pub fn load(paths: &Paths) -> Vec<Friend> {
    std::fs::read_to_string(file(paths)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default()
}

pub fn save(paths: &Paths, list: &[Friend]) -> Result<()> {
    crate::paths::ensure_parent(&file(paths))?;
    std::fs::write(file(paths), serde_json::to_vec_pretty(list)?)?;
    Ok(())
}

pub fn valid_name(name: &str) -> bool {
    (3..=16).contains(&name.len()) && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

/// Adds a friend; a second add of the same nickname only refreshes the UUID.
pub fn add(list: &mut Vec<Friend>, name: &str, uuid: Option<String>) -> Result<()> {
    if !valid_name(name) {
        bail!("Ник: 3–16 символов, латиница, цифры и _");
    }
    if let Some(f) = list.iter_mut().find(|f| f.name.eq_ignore_ascii_case(name)) {
        f.uuid = uuid.or(f.uuid.take());
        return Ok(());
    }
    list.push(Friend { name: name.to_string(), uuid, note: String::new(), added: crate::instances::now() });
    Ok(())
}

pub fn remove(list: &mut Vec<Friend>, name: &str) {
    list.retain(|f| !f.name.eq_ignore_ascii_case(name));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_and_removes() {
        let mut l = Vec::new();
        add(&mut l, "Notch", None).unwrap();
        add(&mut l, "notch", Some("069a79f444e94726a5befca90e38aaf5".into())).unwrap();
        assert_eq!(l.len(), 1);
        assert!(l[0].uuid.is_some());
        assert!(add(&mut l, "no", None).is_err());
        assert!(add(&mut l, "bad name", None).is_err());
        remove(&mut l, "NOTCH");
        assert!(l.is_empty());
    }
}
