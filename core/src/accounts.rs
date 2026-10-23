//! Player accounts: offline nicknames and Microsoft (licensed) accounts.

use crate::paths::Paths;
use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Offline,
    Microsoft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub kind: AccountKind,
    pub name: String,
    /// Minecraft profile UUID without dashes.
    pub uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    /// Unix seconds when `access_token` stops working.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub xuid: Option<String>,
    /// Offline accounts only: a custom skin is saved, and whether it uses slim arms.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_skin_slim: Option<bool>,
}

/// What the UI sees: no tokens.
#[derive(Debug, Clone, Serialize)]
pub struct AccountView {
    pub id: String,
    pub kind: AccountKind,
    pub name: String,
    pub uuid: String,
    pub custom_skin: bool,
}

impl From<&Account> for AccountView {
    fn from(a: &Account) -> Self {
        Self {
            id: a.id.clone(),
            kind: a.kind.clone(),
            name: a.name.clone(),
            uuid: a.uuid.clone(),
            custom_skin: a.custom_skin_slim.is_some(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountStore {
    #[serde(default)]
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub selected: Option<String>,
}

impl AccountStore {
    pub fn load(paths: &Paths) -> Self {
        std::fs::read_to_string(paths.accounts_file())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, paths: &Paths) -> Result<()> {
        crate::paths::ensure_parent(&paths.accounts_file())?;
        std::fs::write(paths.accounts_file(), serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }

    pub fn selected(&self) -> Option<&Account> {
        let id = self.selected.as_ref()?;
        self.accounts.iter().find(|a| &a.id == id)
    }

    /// Adds or replaces (same kind + uuid) an account and selects it.
    pub fn upsert(&mut self, acc: Account) {
        if let Some(old) = self.accounts.iter_mut().find(|a| a.kind == acc.kind && a.uuid == acc.uuid) {
            let id = old.id.clone();
            let custom_skin_slim = acc.custom_skin_slim.or(old.custom_skin_slim);
            *old = Account { id: id.clone(), custom_skin_slim, ..acc };
            self.selected = Some(id);
        } else {
            self.selected = Some(acc.id.clone());
            self.accounts.push(acc);
        }
    }

    pub fn remove(&mut self, id: &str) {
        self.accounts.retain(|a| a.id != id);
        if self.selected.as_deref() == Some(id) {
            self.selected = self.accounts.first().map(|a| a.id.clone());
        }
    }
}

/// Same UUID the vanilla server uses for offline players: v3 of "OfflinePlayer:<name>".
pub fn offline_uuid(name: &str) -> String {
    let mut b = md5::compute(format!("OfflinePlayer:{name}")).0;
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    hex::encode(b)
}

pub fn validate_nick(name: &str) -> Result<()> {
    let ok = (3..=16).contains(&name.len()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    if !ok {
        bail!("Ник должен быть от 3 до 16 символов: латиница, цифры и _");
    }
    Ok(())
}

pub fn offline(name: &str) -> Result<Account> {
    validate_nick(name)?;
    Ok(Account {
        id: uuid::Uuid::new_v4().to_string(),
        kind: AccountKind::Offline,
        name: name.to_string(),
        uuid: offline_uuid(name),
        access_token: None,
        refresh_token: None,
        expires_at: None,
        xuid: None,
        custom_skin_slim: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_uuid_matches_vanilla() {
        // Known value: UUID.nameUUIDFromBytes("OfflinePlayer:Notch")
        assert_eq!(offline_uuid("Notch"), "b50ad385829d3141a2167e7d7539ba7f");
    }

    #[test]
    fn nick_rules() {
        assert!(offline("Steve_01").is_ok());
        assert!(offline("ab").is_err());
        assert!(offline("Привет").is_err());
        assert!(offline("a_very_long_nickname").is_err());
    }

    #[test]
    fn store_upsert_and_remove() {
        let mut s = AccountStore::default();
        let a = offline("Alex").unwrap();
        let id = a.id.clone();
        s.upsert(a);
        s.upsert(offline("Alex").unwrap());
        assert_eq!(s.accounts.len(), 1);
        assert_eq!(s.selected.as_deref(), Some(id.as_str()));
        s.upsert(offline("Steve").unwrap());
        s.remove(&s.selected.clone().unwrap());
        assert_eq!(s.selected.as_deref(), Some(id.as_str()));
    }
}
