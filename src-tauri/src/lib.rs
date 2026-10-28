//! Tauri shell: exposes the core to the UI as commands and events.

mod media;

use bi4visual_core::{
    accounts::{self, AccountStore, AccountView},
    backgrounds, cosmetics, music,
    download, fabric, forge,
    instances::{self, Instance, Loader, ModFile},
    java, launch, lyrics,
    manifest::{self, VersionJson},
    microsoft,
    modrinth::{self, ProjectType, SearchResult},
    paths::Paths,
    settings::Settings,
    skins, Progress, ProgressFn,
};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
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
fn save_settings(st: State<AppState>, mut settings: Settings) -> Res<()> {
    // The background file is managed by its own commands.
    settings.background = Settings::load(&st.paths).background;
    settings.save(&st.paths).map_err(err)
}

#[tauri::command]
fn background_get(st: State<AppState>) -> Option<String> {
    let name = Settings::load(&st.paths).background?;
    backgrounds::load(&st.paths, &name)
}

/// Saves a picture as the background and returns it as a data URL.
#[tauri::command]
fn background_set(st: State<AppState>, data: String) -> Res<String> {
    let name = backgrounds::save_base64(&st.paths, &data).map_err(err)?;
    let mut s = Settings::load(&st.paths);
    s.background = Some(name.clone());
    s.save(&st.paths).map_err(err)?;
    backgrounds::load(&st.paths, &name).ok_or_else(|| "Не удалось прочитать картинку".into())
}

#[tauri::command]
fn background_clear(st: State<AppState>) -> Res<()> {
    backgrounds::clear(&st.paths);
    let mut s = Settings::load(&st.paths);
    s.background = None;
    s.save(&st.paths).map_err(err)
}

// ---------- launcher music ----------

#[tauri::command]
fn music_list(st: State<AppState>) -> Vec<String> {
    music::list(&st.paths)
}

#[tauri::command]
fn music_add(st: State<AppState>, name: String, data: String) -> Res<Vec<String>> {
    music::add_base64(&st.paths, &name, &data).map_err(err)?;
    Ok(music::list(&st.paths))
}

#[tauri::command]
fn music_remove(st: State<AppState>, name: String) -> Res<Vec<String>> {
    music::remove(&st.paths, &name).map_err(err)?;
    Ok(music::list(&st.paths))
}

#[tauri::command]
fn music_load(st: State<AppState>, name: String) -> Res<String> {
    music::load(&st.paths, &name).ok_or_else(|| "Не удалось прочитать трек".into())
}

#[tauri::command]
fn music_open_dir(app: AppHandle, st: State<AppState>) -> Res<()> {
    open_dir(&app, music::dir(&st.paths))
}

// ---------- start with the system ----------

#[cfg(windows)]
const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";

#[cfg(windows)]
fn reg(args: &[&str]) -> std::io::Result<std::process::Output> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg").args(args).creation_flags(0x0800_0000).output()
}

#[tauri::command]
fn autostart_get() -> bool {
    #[cfg(windows)]
    {
        reg(&["query", RUN_KEY, "/v", "bi4visual launcher"]).map(|o| o.status.success()).unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
fn autostart_set(enabled: bool) -> Res<()> {
    #[cfg(windows)]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let value = format!("\"{}\"", exe.display());
        let out = if enabled {
            reg(&["add", RUN_KEY, "/v", "bi4visual launcher", "/t", "REG_SZ", "/d", &value, "/f"])
        } else {
            reg(&["delete", RUN_KEY, "/v", "bi4visual launcher", "/f"])
        }
        .map_err(|e| e.to_string())?;
        if !out.status.success() && enabled {
            return Err("Windows не дал включить автозапуск".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = enabled;
        Err("Автозапуск пока есть только на Windows".into())
    }
}

#[tauri::command]
fn cosmetics_open_dir(app: AppHandle, st: State<AppState>) -> Res<()> {
    open_dir(&app, cosmetics::dir(&st.paths))
}

#[tauri::command]
fn cosmetics_import(st: State<AppState>) -> Res<usize> {
    cosmetics::import(&st.paths).map_err(err)
}

#[tauri::command]
fn cosmetics_count(st: State<AppState>) -> usize {
    cosmetics::names(&st.paths).len()
}

#[tauri::command]
fn cosmetics_clear(st: State<AppState>) -> Res<()> {
    cosmetics::clear(&st.paths).map_err(err)
}

#[tauri::command]
fn launcher_dir(app: AppHandle, st: State<AppState>) -> Res<()> {
    open_dir(&app, st.paths.root.clone())
}

fn open_dir(app: &AppHandle, dir: std::path::PathBuf) -> Res<()> {
    use tauri_plugin_opener::OpenerExt;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

// ---------- game versions and loaders ----------

#[derive(Serialize)]
struct GameVersion {
    id: String,
    kind: String,
}

#[derive(Serialize)]
struct GameVersions {
    latest: String,
    versions: Vec<GameVersion>,
}

#[tauri::command]
async fn game_versions(st: State<'_, AppState>) -> Res<GameVersions> {
    let m = manifest::fetch_manifest(&st.client).await.map_err(err)?;
    Ok(GameVersions {
        latest: m.latest.release,
        versions: m.versions.into_iter().map(|v| GameVersion { id: v.id, kind: v.kind }).collect(),
    })
}

#[tauri::command]
async fn loader_versions(st: State<'_, AppState>, loader: Loader, game: String) -> Res<Vec<String>> {
    let c = &st.client;
    match loader {
        Loader::Vanilla => Ok(vec![]),
        Loader::Fabric => fabric::loader_versions(c, fabric::Flavor::Fabric, &game).await,
        Loader::Quilt => fabric::loader_versions(c, fabric::Flavor::Quilt, &game).await,
        Loader::Forge => forge::versions(c, forge::Flavor::Forge, &game).await,
        Loader::NeoForge => forge::versions(c, forge::Flavor::NeoForge, &game).await,
    }
    .map_err(err)
}

// ---------- instances ----------

#[derive(Serialize)]
struct InstancesResponse {
    instances: Vec<Instance>,
    selected: Option<String>,
}

fn instances_response(paths: &Paths) -> InstancesResponse {
    let list = instances::list(paths);
    let settings = Settings::load(paths);
    let selected = settings
        .selected_instance
        .filter(|id| list.iter().any(|i| &i.id == id))
        .or_else(|| list.first().map(|i| i.id.clone()));
    InstancesResponse { instances: list, selected }
}

#[tauri::command]
fn instances_list(st: State<AppState>) -> InstancesResponse {
    instances_response(&st.paths)
}

fn select(paths: &Paths, id: &str) -> Res<()> {
    let mut s = Settings::load(paths);
    s.selected_instance = Some(id.to_string());
    s.save(paths).map_err(err)
}

#[tauri::command]
fn instance_create(
    st: State<AppState>,
    name: String,
    game: String,
    loader: Loader,
    loader_version: Option<String>,
) -> Res<InstancesResponse> {
    let inst = instances::create(&st.paths, &name, &game, loader, loader_version).map_err(err)?;
    select(&st.paths, &inst.id)?;
    Ok(instances_response(&st.paths))
}

#[tauri::command]
fn instance_select(st: State<AppState>, id: String) -> Res<InstancesResponse> {
    select(&st.paths, &id)?;
    Ok(instances_response(&st.paths))
}

#[tauri::command]
fn instance_delete(st: State<AppState>, id: String) -> Res<InstancesResponse> {
    instances::delete(&st.paths, &id).map_err(err)?;
    Ok(instances_response(&st.paths))
}

#[tauri::command]
fn instance_open_dir(app: AppHandle, st: State<AppState>, id: String) -> Res<()> {
    let inst = Instance::load(&st.paths, &id).map_err(err)?;
    open_dir(&app, inst.game_dir(&st.paths))
}

/// The first time, makes a vanilla instance on the latest release and moves the
/// old shared game folder (from version 0.1) into it.
/// Modrinth id of Fabric API.
const FABRIC_API: &str = "P7dR8mSH";

/// Fabric API installed through us, or a jar of it the player put there by hand.
fn has_fabric_api(paths: &Paths, inst: &Instance) -> bool {
    inst.mods.iter().any(|m| m.project_id == FABRIC_API)
        || std::fs::read_dir(instances::mods_dir(paths, &inst.id))
            .map(|d| d.flatten().any(|e| e.file_name().to_string_lossy().starts_with("fabric-api")))
            .unwrap_or(false)
}

/// Titles match ignoring case and spaces ("EntityCulling" is "Entity Culling").
fn same_title(a: &str, b: &str) -> bool {
    let norm = |s: &str| s.chars().filter(|c| !c.is_whitespace()).collect::<String>().to_lowercase();
    norm(a) == norm(b)
}

/// Finds a mod on Modrinth by its exact title for the instance's version and installs it.
/// False when Modrinth has no build of it for this version.
async fn install_by_title(client: &reqwest::Client, paths: &Paths, inst: &mut Instance, title: &str) -> anyhow::Result<bool> {
    let found = modrinth::search(client, title, ProjectType::Mod, Some(&inst.game_version), Some("fabric"), 0).await?;
    let Some(hit) = found.hits.into_iter().find(|h| same_title(&h.title, title)) else {
        return Ok(false);
    };
    modrinth::install_mod(client, paths, inst, &hit.project_id).await?;
    Ok(true)
}

async fn ensure_default_instance(st: &AppState) -> anyhow::Result<Instance> {
    let resp = instances_response(&st.paths);
    if let Some(id) = resp.selected {
        return Instance::load(&st.paths, &id);
    }
    let latest = manifest::fetch_manifest(&st.client).await?.latest.release;
    let inst = instances::create(&st.paths, &format!("Fabric {latest}"), &latest, Loader::Fabric, None)?;
    let old = st.paths.root.join("minecraft");
    if old.is_dir() {
        let dir = inst.game_dir(&st.paths);
        for e in std::fs::read_dir(&old)?.flatten() {
            let dest = dir.join(e.file_name());
            if !dest.exists() {
                let _ = std::fs::rename(e.path(), dest);
            }
        }
    }
    select(&st.paths, &inst.id).map_err(anyhow::Error::msg)?;
    Ok(inst)
}

// ---------- mods ----------

#[tauri::command]
fn mods_list(st: State<AppState>, instance: String) -> Res<Vec<ModFile>> {
    let inst = Instance::load(&st.paths, &instance).map_err(err)?;
    Ok(instances::mod_files(&st.paths, &inst))
}

#[tauri::command]
fn mod_toggle(st: State<AppState>, instance: String, file: String, enabled: bool) -> Res<()> {
    let inst = Instance::load(&st.paths, &instance).map_err(err)?;
    instances::set_mod_enabled(&st.paths, &inst, &file, enabled).map_err(err)
}

#[tauri::command]
fn mod_remove(st: State<AppState>, instance: String, file: String) -> Res<()> {
    let mut inst = Instance::load(&st.paths, &instance).map_err(err)?;
    instances::remove_mod(&st.paths, &mut inst, &file).map_err(err)
}

#[tauri::command]
async fn modrinth_search(
    st: State<'_, AppState>,
    query: String,
    kind: ProjectType,
    instance: Option<String>,
    offset: u32,
) -> Res<SearchResult> {
    let inst = instance.and_then(|id| Instance::load(&st.paths, &id).ok());
    let game = inst.as_ref().map(|i| i.game_version.as_str());
    // Modpacks: only Fabric ones, the launcher makes nothing else.
    let loader = inst.as_ref().and_then(|i| i.loader.modrinth()).or((kind == ProjectType::Modpack).then_some("fabric"));
    modrinth::search(&st.client, &query, kind, game, loader, offset).await.map_err(err)
}

#[tauri::command]
async fn modrinth_install_mod(st: State<'_, AppState>, instance: String, project: String) -> Res<Vec<String>> {
    let mut inst = Instance::load(&st.paths, &instance).map_err(err)?;
    modrinth::install_mod(&st.client, &st.paths, &mut inst, &project).await.map_err(err)
}

#[tauri::command]
async fn modrinth_install_pack(app: AppHandle, st: State<'_, AppState>, project: String) -> Res<InstancesResponse> {
    let _guard = st.busy.clone().try_lock_owned().map_err(|_| "Сейчас идёт установка или игра".to_string())?;
    let inst = modrinth::install_modpack(&st.client, &st.paths, &project, &progress_to(&app)).await.map_err(err)?;
    select(&st.paths, &inst.id)?;
    Ok(instances_response(&st.paths))
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

#[tauri::command]
async fn account_skin(st: State<'_, AppState>, id: String) -> Res<Option<skins::Skin>> {
    let store = AccountStore::load(&st.paths);
    let acc = store.accounts.iter().find(|a| a.id == id).ok_or("Аккаунт не найден")?;
    skins::skin_for(&st.client, &st.paths, acc).await.map_err(err)
}

/// Microsoft accounts upload to Mojang; offline accounts keep the skin locally.
#[tauri::command]
async fn account_upload_skin(st: State<'_, AppState>, id: String, png: Vec<u8>, slim: bool) -> Res<AccountsResponse> {
    let mut store = AccountStore::load(&st.paths);
    let mut acc = store.accounts.iter().find(|a| a.id == id).cloned().ok_or("Аккаунт не найден")?;
    if acc.kind == accounts::AccountKind::Offline {
        skins::save_custom(&st.paths, &acc, &png).map_err(err)?;
        acc.custom_skin_slim = Some(slim);
        if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
            *a = acc;
        }
        store.save(&st.paths).map_err(err)?;
        return Ok(accounts_response(&store));
    }
    if let Some(fresh) = microsoft::refresh_if_needed(&st.client, &acc).await.map_err(err)? {
        if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
            *a = fresh.clone();
        }
        store.save(&st.paths).map_err(err)?;
        acc = fresh;
    }
    skins::upload(&st.client, &acc, png, slim).await.map_err(err)?;
    Ok(accounts_response(&store))
}

#[tauri::command]
fn account_reset_skin(st: State<AppState>, id: String) -> Res<AccountsResponse> {
    let mut store = AccountStore::load(&st.paths);
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        skins::remove_custom(&st.paths, a);
        a.custom_skin_slim = None;
    }
    store.save(&st.paths).map_err(err)?;
    Ok(accounts_response(&store))
}

// ---------- play ----------

/// Installs what is missing, then starts the selected instance with the selected account.
#[tauri::command]
async fn play(app: AppHandle, st: State<'_, AppState>) -> Res<()> {
    let guard = st.busy.clone().try_lock_owned().map_err(|_| "Игра уже запущена".to_string())?;
    let progress = progress_to(&app);
    let settings = Settings::load(&st.paths);
    let mut store = AccountStore::load(&st.paths);
    let mut account = store.selected().cloned().ok_or("Сначала добавьте аккаунт")?;

    if let Some(fresh) = microsoft::refresh_if_needed(&st.client, &account).await.map_err(err)? {
        store.upsert(fresh.clone());
        store.save(&st.paths).map_err(err)?;
        account = fresh;
    }

    let _ = app.emit("game-state", GameState { state: "installing", code: None });
    let bundled_mods = app.path().resource_dir().map(|d| d.join("mods")).unwrap_or_default();
    let log = {
        let app = app.clone();
        move |line: String| {
            let _ = app.emit("game-log", format!("[bi4visual] {line}"));
        }
    };
    let result: anyhow::Result<(launch::LaunchPlan, String, bool)> = async {
        let mut inst = ensure_default_instance(&st).await?;
        // The visuals live in a Fabric mod: a plain build of a supported version
        // (made by an older launcher) is moved to Fabric, which plays the same without other mods.
        if inst.loader == Loader::Vanilla && lyrics::has_mod(&bundled_mods, &inst.game_version) {
            inst.loader = Loader::Fabric;
            inst.loader_version = None;
            inst.version_id = None;
            inst.save(&st.paths)?;
            log(format!("Сборка {} переведена на Fabric, чтобы работали визуалы bi4visual", inst.name));
        }
        let version = instances::ensure_ready(&st.client, &st.paths, &mut inst, &progress).await?;
        let major = VersionJson::load_resolved(&st.paths, &version)?.java_major();
        let java_bin = match settings.java_path.clone().filter(|p| !p.trim().is_empty()) {
            Some(p) => p.into(),
            None => java::ensure(&st.client, &st.paths, major, &progress).await?,
        };
        inst.last_played = Some(instances::now());
        inst.save(&st.paths)?;
        skins::apply_pack(&st.paths, &account, &inst.game_dir(&st.paths))?;
        let lyrics_mod = inst.loader == Loader::Fabric
            && lyrics::install_mod(&bundled_mods, &instances::mods_dir(&st.paths, &inst.id), &inst.game_version, true)?;
        let plan = launch::build(&st.paths, &version, &account, &settings, java_bin, inst.game_dir(&st.paths))?;
        // The mod's font and other assets are loaded by Fabric API.
        if lyrics_mod && !has_fabric_api(&st.paths, &inst) {
            match modrinth::install_mod(&st.client, &st.paths, &mut inst, FABRIC_API).await {
                Ok(_) => {
                    inst.save(&st.paths)?;
                    log("Поставил Fabric API, он нужен моду bi4visual".into());
                }
                Err(e) => log(format!("Не удалось поставить Fabric API: {e}")),
            }
        }
        if lyrics_mod {
            if let Err(e) = cosmetics::apply(&st.paths, &inst.game_dir(&st.paths)) {
                log(format!("Не удалось подключить косметику: {e}"));
            }
            let fast = settings.performance_mods;
            for (wanted, title) in [
                (settings.hold_my_items, "Hold My Items"),
                (settings.voice_chat, "Simple Voice Chat"),
                // Speed-ups: rendering, game logic, memory, start-up, hidden entities.
                (fast, "Sodium"),
                (fast, "Lithium"),
                (fast, "ImmediatelyFast"),
                (fast, "FerriteCore"),
                (fast, "ModernFix"),
                (fast, "Entity Culling"),
            ] {
                if !wanted || inst.mods.iter().any(|m| same_title(&m.title, title)) {
                    continue;
                }
                match install_by_title(&st.client, &st.paths, &mut inst, title).await {
                    Ok(true) => {
                        inst.save(&st.paths)?;
                        log(format!("Поставил {title}"));
                    }
                    Ok(false) => log(format!("{title} пока нет для {} Fabric", inst.game_version)),
                    Err(e) => log(format!("Не удалось поставить {title}: {e}")),
                }
            }
        }
        log(if lyrics_mod {
            format!("Мод bi4visual установлен ({} Fabric), меню визуалов в игре — правый Shift", inst.game_version)
        } else {
            format!("Визуалы bi4visual не будут работать: нужен Fabric 1.21.4 или новее, а у сборки {} {:?}", inst.game_version, inst.loader)
        });
        Ok((plan, inst.id, lyrics_mod))
    }
    .await;
    let (plan, instance_id, lyrics_mod) = match result {
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

    type Pipe = Box<dyn tokio::io::AsyncRead + Send + Unpin>;
    let pipes: [Option<Pipe>; 2] = [
        child.stdout.take().map(|p| Box::new(p) as Pipe),
        child.stderr.take().map(|p| Box::new(p) as Pipe),
    ];
    for pipe in pipes.into_iter().flatten() {
        let app = app.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app.emit("game-log", line);
            }
        });
    }

    let _ = app.emit("game-state", GameState { state: "running", code: None });
    if let Some(w) = app.get_webview_window("main") {
        match settings.on_launch.as_str() {
            "keep" => {}
            "minimize" => {
                let _ = w.minimize();
            }
            _ => {
                let _ = w.hide();
            }
        }
    }
    let restore = settings.restore_after_game || settings.on_launch == "hide";

    let stop_media = Arc::new(AtomicBool::new(false));
    if lyrics_mod {
        tokio::spawn(media::watch(st.client.clone(), plan.game_dir.clone(), stop_media.clone(), log.clone()));
    }

    // Wait in the background so the command returns right away; the lock lives until exit.
    let app2 = app.clone();
    let paths = st.paths.clone();
    let started = std::time::Instant::now();
    tokio::spawn(async move {
        let _hold = guard;
        let code = child.wait().await.ok().and_then(|s| s.code());
        stop_media.store(true, Ordering::Relaxed);
        if let Ok(mut inst) = Instance::load(&paths, &instance_id) {
            inst.playtime_secs += started.elapsed().as_secs();
            let _ = inst.save(&paths);
        }
        if let Some(w) = app2.get_webview_window("main").filter(|_| restore) {
            let _ = w.show();
            let _ = w.unminimize();
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            paths,
            client: download::client(),
            busy: Arc::new(Mutex::new(())),
            device_code: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            background_get,
            background_set,
            background_clear,
            game_versions,
            loader_versions,
            instances_list,
            instance_create,
            instance_select,
            instance_delete,
            instance_open_dir,
            mods_list,
            mod_toggle,
            mod_remove,
            modrinth_search,
            modrinth_install_mod,
            modrinth_install_pack,
            accounts_list,
            account_add_offline,
            account_select,
            account_remove,
            ms_login_start,
            ms_login_finish,
            account_skin,
            account_upload_skin,
            account_reset_skin,
            play,
            music_list,
            music_add,
            music_remove,
            music_load,
            music_open_dir,
            autostart_get,
            autostart_set,
            launcher_dir,
            cosmetics_open_dir,
            cosmetics_import,
            cosmetics_count,
            cosmetics_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running bi4visual launcher");
}
