//! Microsoft account sign-in for licensed Minecraft, via the OAuth device code flow:
//! Microsoft → Xbox Live → XSTS → Minecraft services.
//!
//! Needs an Azure app client id, baked in at build time with the
//! `BI4VISUAL_MS_CLIENT_ID` environment variable.

use crate::accounts::{Account, AccountKind};
use anyhow::{anyhow, bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MS_BASE: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const SCOPE: &str = "XboxLive.signin offline_access";

pub fn client_id() -> Option<&'static str> {
    option_env!("BI4VISUAL_MS_CLIENT_ID").filter(|s| !s.is_empty())
}

fn require_client_id() -> Result<&'static str> {
    client_id().ok_or_else(|| anyhow!("Вход через Microsoft не настроен в этой сборке"))
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    error: Option<String>,
}

/// Step 1: get a code the player types at microsoft.com/link.
pub async fn start(client: &reqwest::Client) -> Result<DeviceCode> {
    let id = require_client_id()?;
    Ok(client
        .post(format!("{MS_BASE}/devicecode"))
        .form(&[("client_id", id), ("scope", SCOPE)])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?)
}

/// Step 2: wait until the player confirms, then finish the whole chain.
pub async fn finish(client: &reqwest::Client, code: &DeviceCode) -> Result<Account> {
    let id = require_client_id()?;
    let deadline = now() + code.expires_in;
    let mut interval = code.interval.max(1);
    loop {
        if now() > deadline {
            bail!("Время на вход истекло, попробуйте ещё раз");
        }
        tokio::time::sleep(Duration::from_secs(interval)).await;
        let r: TokenResponse = client
            .post(format!("{MS_BASE}/token"))
            .form(&[
                ("client_id", id),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", code.device_code.as_str()),
            ])
            .send()
            .await?
            .json()
            .await?;
        match (r.access_token, r.error.as_deref()) {
            (Some(token), _) => return minecraft_login(client, &token, r.refresh_token).await,
            (None, Some("authorization_pending")) => continue,
            (None, Some("slow_down")) => interval += 5,
            (None, Some("authorization_declined")) => bail!("Вход отменён"),
            (None, Some("expired_token")) => bail!("Время на вход истекло, попробуйте ещё раз"),
            (None, e) => bail!("Ошибка входа Microsoft: {}", e.unwrap_or("неизвестно")),
        }
    }
}

/// Gets a fresh Minecraft token when the stored one is about to expire.
pub async fn refresh_if_needed(client: &reqwest::Client, acc: &Account) -> Result<Option<Account>> {
    if acc.kind != AccountKind::Microsoft || acc.expires_at.unwrap_or(0) > now() + 300 {
        return Ok(None);
    }
    let id = require_client_id()?;
    let refresh = acc.refresh_token.as_deref().ok_or_else(|| anyhow!("Войдите в аккаунт Microsoft заново"))?;
    let r: TokenResponse = client
        .post(format!("{MS_BASE}/token"))
        .form(&[("client_id", id), ("grant_type", "refresh_token"), ("refresh_token", refresh), ("scope", SCOPE)])
        .send()
        .await?
        .json()
        .await?;
    let token = r.access_token.ok_or_else(|| anyhow!("Войдите в аккаунт Microsoft заново"))?;
    let mut fresh = minecraft_login(client, &token, r.refresh_token.or(acc.refresh_token.clone())).await?;
    fresh.id = acc.id.clone();
    Ok(Some(fresh))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct XblResponse {
    token: String,
    display_claims: DisplayClaims,
}

#[derive(Debug, Deserialize)]
struct DisplayClaims {
    xui: Vec<serde_json::Value>,
}

async fn minecraft_login(client: &reqwest::Client, ms_token: &str, refresh: Option<String>) -> Result<Account> {
    let xbl: XblResponse = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&json!({
            "Properties": {"AuthMethod": "RPS", "SiteName": "user.auth.xboxlive.com", "RpsTicket": format!("d={ms_token}")},
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }))
        .send()
        .await?
        .error_for_status()
        .context("Xbox Live не принял вход")?
        .json()
        .await?;
    let uhs = xbl.display_claims.xui.first().and_then(|x| x["uhs"].as_str()).unwrap_or_default().to_string();

    let resp = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&json!({
            "Properties": {"SandboxId": "RETAIL", "UserTokens": [xbl.token]},
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }))
        .send()
        .await?;
    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        match body["XErr"].as_u64() {
            Some(2148916233) => bail!("У этого аккаунта Microsoft нет профиля Xbox. Создайте его на xbox.com"),
            Some(2148916235) => bail!("Xbox Live недоступен в вашей стране"),
            Some(2148916238) => bail!("Детский аккаунт: его нужно добавить в семью Microsoft"),
            _ => bail!("Xbox Live отказал во входе"),
        }
    }
    let xsts: XblResponse = resp.error_for_status()?.json().await?;
    let xuid = xsts.display_claims.xui.first().and_then(|x| x["xid"].as_str()).map(String::from);

    #[derive(Deserialize)]
    struct McLogin {
        access_token: String,
        expires_in: u64,
    }
    let mc: McLogin = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&json!({"identityToken": format!("XBL3.0 x={uhs};{}", xsts.token)}))
        .send()
        .await?
        .error_for_status()
        .context("Сервис Minecraft не принял вход")?
        .json()
        .await?;

    #[derive(Deserialize)]
    struct Profile {
        id: String,
        name: String,
    }
    let resp = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(&mc.access_token)
        .send()
        .await?;
    if resp.status() == reqwest::StatusCode::NOT_FOUND {
        bail!("На этом аккаунте не куплен Minecraft: Java Edition");
    }
    let profile: Profile = resp.error_for_status()?.json().await?;

    Ok(Account {
        id: uuid::Uuid::new_v4().to_string(),
        kind: AccountKind::Microsoft,
        name: profile.name,
        uuid: profile.id,
        access_token: Some(mc.access_token),
        refresh_token: refresh,
        expires_at: Some(now() + mc.expires_in),
        xuid,
        custom_skin_slim: None,
    })
}
