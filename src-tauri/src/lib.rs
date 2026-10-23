//! Tauri shell: exposes the core to the UI as commands and events.

use bi4visual_core::{
    accounts::{self, AccountStore, AccountView},
    download, fabric, install, java, launch,
    manifest::{self, VersionJson},
    microsoft,
    paths::Paths,
    settings::Settings,
    Progress, ProgressFn,
};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;

struct AppState {
    paths: Paths,
    client: reqwest::Client,
    /// Held while installing or playing so the button cannot start two games.
    busy: Arc<Mutex<()>>,
    device_code: Mutex<Option<microsoft::DeviceCode>>,
}

type Res<T> = Result<T, String>;

fn err(e: anyhow::Error) -> String {
    format!("{e:#}")
}

fn progress_to(app: &AppHandle) -> ProgressFn {
    let app = app.clone();
    Arc::new(move |p: Progress| {
        let _ = app.emit("progress", p);
    })
}

#[derive(Serialize, Clone)]
struct GameState {
    state: &'static str,
    code: Option<i32>,
}

// ---------- settings ----------

#[tauri::command]
fn get_settings(st: State<AppState>) -> Settings {
    Settings::load(&st.paths)
}

#[tauri::command]
fn save_settings(st: State<AppState>, settings: Settings) -> Res<()> {
    settings.save(&st.paths).map_err(err)
}

#[tauri::command]
fn default_game_dir(st: State<AppState>) -> String {
    st.paths.default_game_dir().to_string_lossy().into_owned()
}

#[tauri::command]
fn open_game_dir(app: AppHandle, st: State<AppState>) -> Res<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = Settings::load(&st.paths).game_dir(&st.paths);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

// ---------- versions ----------

#[derive(Serialize)]
struct VersionItem {
    id: String,
    kind: String,
    installed: bool,
}

#[derive(Serialize)]
struct VersionList {
    latest: Option<String>,
    online: bool,
    versions: Vec<VersionItem>,
}

#[tauri::command]
async fn list_versions(st: State<'_, AppState>) -> Res<VersionList> {
    let installed = manifest::installed_versions(&st.paths);
    match manifest::fetch_manifest(&st.client).await {
        Ok(m) => {
            let mut versions: Vec<VersionItem> = installed
                .iter()
                .filter(|id| !m.versions.iter().any(|v| &v.id == *id))
                .map(|id| VersionItem { id: id.clone(), kind: "modded".into(), installed: true })
                .collect();
            versions.extend(m.versions.into_iter().map(|v| VersionItem {
                installed: installed.contains(&v.id),
                id: v.id,
                kind: v.kind,
            }));
            Ok(VersionList { latest: Some(m.latest.release), online: true, versions })
        }
        Err(_) => Ok(VersionList {
            latest: None,
            online: false,
            versions: installed.into_iter().map(|id| VersionItem { id, kind: "installed".into(), installed: true }).collect(),
        }),
    }
}

#[tauri::command]
async fn fabric_loaders(st: State<'_, AppState>, game: String) -> Res<Vec<String>> {
    fabric::loader_versions(&st.client, &game).await.map_err(err)
}

/// Creates the Fabric profile; files are downloaded when the game starts.
#[tauri::command]
async fn add_fabric(st: State<'_, AppState>, game: String, loader: String) -> Res<String> {
    fabric::install_profile(&st.client, &st.paths, &game, &loader).await.map_err(err)
}

#[tauri::command]
async fn install_version(app: AppHandle, st: State<'_, AppState>, id: String) -> Res<()> {
    let _guard = st.busy.clone().try_lock_owned().map_err(|_| "Уже идёт установка или игра".to_string())?;
    install::install(&st.client, &st.paths, &id, &progress_to(&app)).await.map_err(err)
}

#[tauri::command]
fn delete_version(st: State<AppState>, id: String) -> Res<()> {
    let dir = st.paths.version_dir(&id);
    if dir.starts_with(st.paths.versions()) && dir != st.paths.versions() {
        std::fs::remove_dir_all(dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------- accounts ----------

#[derive(Serialize)]
struct AccountsResponse {
    accounts: Vec<AccountView>,
    selected: Option<String>,
    microsoft_available: bool,
}

fn accounts_response(store: &AccountStore) -> AccountsResponse {
    AccountsResponse {
        accounts: store.accounts.iter().map(AccountView::from).collect(),
        selected: store.selected.clone(),
        microsoft_available: microsoft::client_id().is_some(),
    }
}

#[tauri::command]
fn accounts_list(st: State<AppState>) -> AccountsResponse {
    accounts_response(&AccountStore::load(&st.paths))
}

#[tauri::command]
fn account_add_offline(st: State<AppState>, name: String) -> Res<AccountsResponse> {
    let mut store = AccountStore::load(&st.paths);
    store.upsert(accounts::offline(name.trim()).map_err(err)?);
    store.save(&st.paths).map_err(err)?;
    Ok(accounts_response(&store))
}

#[tauri::command]
fn account_select(st: State<AppState>, id: String) -> Res<AccountsResponse> {
    let mut store = AccountStore::load(&st.paths);
    if store.accounts.iter().any(|a| a.id == id) {
        store.selected = Some(id);
        store.save(&st.paths).map_err(err)?;
    }
    Ok(accounts_response(&store))
}

#[tauri::command]
fn account_remove(st: State<AppState>, id: String) -> Res<AccountsResponse> {
    let mut store = AccountStore::load(&st.paths);
    store.remove(&id);
    store.save(&st.paths).map_err(err)?;
    Ok(accounts_response(&store))
}

#[tauri::command]
async fn ms_login_start(st: State<'_, AppState>) -> Res<microsoft::DeviceCode> {
    let code = microsoft::start(&st.client).await.map_err(err)?;
    *st.device_code.lock().await = Some(code.clone());
    Ok(code)
}

#[tauri::command]
async fn ms_login_finish(st: State<'_, AppState>) -> Res<AccountsResponse> {
    let code = st.device_code.lock().await.clone().ok_or("Сначала начните вход")?;
    let acc = microsoft::finish(&st.client, &code).await.map_err(err)?;
    let mut store = AccountStore::load(&st.paths);
    store.upsert(acc);
    store.save(&st.paths).map_err(err)?;
    Ok(accounts_response(&store))
}

// ---------- play ----------

/// Installs what is missing, then starts the selected version with the selected account.
#[tauri::command]
async fn play(app: AppHandle, st: State<'_, AppState>) -> Res<()> {
    let guard = st.busy.clone().try_lock_owned().map_err(|_| "Игра уже запущена".to_string())?;
    let progress = progress_to(&app);
    let mut settings = Settings::load(&st.paths);
    let mut store = AccountStore::load(&st.paths);
    let mut account = store.selected().cloned().ok_or("Сначала добавьте аккаунт")?;

    if let Some(fresh) = microsoft::refresh_if_needed(&st.client, &account).await.map_err(err)? {
        store.upsert(fresh.clone());
        store.save(&st.paths).map_err(err)?;
        account = fresh;
    }

    let version = match settings.last_version.clone() {
        Some(v) => v,
        None => {
            let latest = manifest::fetch_manifest(&st.client).await.map_err(err)?.latest.release;
            settings.last_version = Some(latest.clone());
            settings.save(&st.paths).map_err(err)?;
            latest
        }
    };

    let _ = app.emit("game-state", GameState { state: "installing", code: None });
    let result: anyhow::Result<launch::LaunchPlan> = async {
        install::install(&st.client, &st.paths, &version, &progress).await?;
        let major = VersionJson::load_resolved(&st.paths, &version)?.java_major();
        let java_bin = match settings.java_path.clone().filter(|p| !p.trim().is_empty()) {
            Some(p) => p.into(),
            None => java::ensure(&st.client, &st.paths, major, &progress).await?,
        };
        launch::build(&st.paths, &version, &account, &settings, java_bin)
    }
    .await;
    let plan = match result {
        Ok(p) => p,
        Err(e) => {
            let _ = app.emit("game-state", GameState { state: "stopped", code: None });
            return Err(err(e));
        }
    };

    let mut cmd = tokio::process::Command::new(&plan.java);
    cmd.args(&plan.args)
        .current_dir(&plan.game_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let mut child = cmd.spawn().map_err(|e| {
        let _ = app.emit("game-state", GameState { state: "stopped", code: None });
        format!("Не удалось запустить Java: {e}")
    })?;

    for pipe in [child.stdout.take().map(|p| Box::new(p) as Box<dyn tokio::io::AsyncRead + Send + Unpin>),
                 child.stderr.take().map(|p| Box::new(p) as Box<dyn tokio::io::AsyncRead + Send + Unpin>)]
        .into_iter()
        .flatten()
    {
        let app = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("game-log", line);
            }
        });
    }

    let _ = app.emit("game-state", GameState { state: "running", code: None });
    let window = app.get_webview_window("main");
    if settings.hide_on_launch {
        if let Some(w) = &window {
            let _ = w.hide();
        }
    }

    // Wait in the background so the command returns right away; the lock lives until exit.
    let app2 = app.clone();
    tokio::spawn(async move {
        let _hold = guard;
        let code = child.wait().await.ok().and_then(|s| s.code());
        if let Some(w) = app2.get_webview_window("main") {
            let _ = w.show();
            let _ = w.set_focus();
        }
        let _ = app2.emit("game-state", GameState { state: "stopped", code });
    });
    Ok(())
}

pub fn run() {
    let paths = Paths::new(Paths::default_root());
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            paths,
            client: download::client(),
            busy: Arc::new(Mutex::new(())),
            device_code: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            default_game_dir,
            open_game_dir,
            list_versions,
            fabric_loaders,
            add_fabric,
            install_version,
            delete_version,
            accounts_list,
            account_add_offline,
            account_select,
            account_remove,
            ms_login_start,
            ms_login_finish,
            play,
        ])
        .run(tauri::generate_context!())
        .expect("error while running bi4visual launcher");
}
