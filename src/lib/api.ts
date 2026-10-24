import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Settings = {
  memory_mb: number;
  java_path: string | null;
  extra_jvm_args: string;
  width: number | null;
  height: number | null;
  fullscreen: boolean;
  hide_on_launch: boolean;
  selected_instance: string | null;
  show_snapshots: boolean;
  background: string | null;
  bg_dim: number;
  bg_blur: number;
  particles: boolean;
  lyrics: boolean;
  sky: "galaxy" | "aurora" | "both" | "off";
  always_night: boolean;
  cosmetics: string[];
  accent: string;
  bg_preset: string;
  ui_scale: number;
  on_launch: "keep" | "minimize" | "hide";
  restore_after_game: boolean;
  music: boolean;
  music_autoplay: boolean;
  music_volume: number;
  ui_sounds: boolean;
  hold_my_items: boolean;
  voice_chat: boolean;
};

export type Loader = "vanilla" | "fabric" | "quilt" | "forge" | "neoforge";
export type Instance = {
  id: string;
  name: string;
  game_version: string;
  loader: Loader;
  loader_version: string | null;
  icon_url: string | null;
  last_played: number | null;
  playtime_secs: number;
};
export type Instances = { instances: Instance[]; selected: string | null };
export type ModFile = { file_name: string; enabled: boolean; title: string; project_id: string | null; icon_url: string | null };
export type Hit = {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  author: string;
  categories: string[];
};
export type SearchResult = { hits: Hit[]; total_hits: number };

export type Account = { id: string; kind: "offline" | "microsoft"; name: string; uuid: string; custom_skin: boolean };
export type Accounts = { accounts: Account[]; selected: string | null; microsoft_available: boolean };
export type Skin = { data_url: string; slim: boolean };
export type GameVersions = { latest: string; versions: { id: string; kind: string }[] };
export type DeviceCode = { user_code: string; verification_uri: string; expires_in: number };
export type Progress = { stage: string; done: number; total: number };
export type GameState = { state: "installing" | "running" | "stopped"; code: number | null };

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  background: () => invoke<string | null>("background_get"),
  setBackground: (data: string) => invoke<string>("background_set", { data }),
  clearBackground: () => invoke<void>("background_clear"),

  gameVersions: () => invoke<GameVersions>("game_versions"),
  loaderVersions: (loader: Loader, game: string) => invoke<string[]>("loader_versions", { loader, game }),

  instances: () => invoke<Instances>("instances_list"),
  createInstance: (name: string, game: string, loader: Loader, loaderVersion: string | null) =>
    invoke<Instances>("instance_create", { name, game, loader, loaderVersion }),
  selectInstance: (id: string) => invoke<Instances>("instance_select", { id }),
  deleteInstance: (id: string) => invoke<Instances>("instance_delete", { id }),
  openInstanceDir: (id: string) => invoke<void>("instance_open_dir", { id }),

  mods: (instance: string) => invoke<ModFile[]>("mods_list", { instance }),
  toggleMod: (instance: string, file: string, enabled: boolean) => invoke<void>("mod_toggle", { instance, file, enabled }),
  removeMod: (instance: string, file: string) => invoke<void>("mod_remove", { instance, file }),
  search: (query: string, kind: "mod" | "modpack", instance: string | null, offset = 0) =>
    invoke<SearchResult>("modrinth_search", { query, kind, instance, offset }),
  installMod: (instance: string, project: string) => invoke<string[]>("modrinth_install_mod", { instance, project }),
  installPack: (project: string) => invoke<Instances>("modrinth_install_pack", { project }),

  accounts: () => invoke<Accounts>("accounts_list"),
  addOffline: (name: string) => invoke<Accounts>("account_add_offline", { name }),
  selectAccount: (id: string) => invoke<Accounts>("account_select", { id }),
  removeAccount: (id: string) => invoke<Accounts>("account_remove", { id }),
  msStart: () => invoke<DeviceCode>("ms_login_start"),
  msFinish: () => invoke<Accounts>("ms_login_finish"),
  skin: (id: string) => invoke<Skin | null>("account_skin", { id }),
  uploadSkin: (id: string, png: number[], slim: boolean) => invoke<Accounts>("account_upload_skin", { id, png, slim }),
  resetSkin: (id: string) => invoke<Accounts>("account_reset_skin", { id }),

  play: () => invoke<void>("play"),

  musicList: () => invoke<string[]>("music_list"),
  musicAdd: (name: string, data: string) => invoke<string[]>("music_add", { name, data }),
  musicRemove: (name: string) => invoke<string[]>("music_remove", { name }),
  musicLoad: (name: string) => invoke<string>("music_load", { name }),
  musicOpenDir: () => invoke<void>("music_open_dir"),
  cosmeticsOpenDir: () => invoke<void>("cosmetics_open_dir"),
  cosmeticsImport: () => invoke<number>("cosmetics_import"),
  cosmeticsCount: () => invoke<number>("cosmetics_count"),
  cosmeticsClear: () => invoke<void>("cosmetics_clear"),
  autostartGet: () => invoke<boolean>("autostart_get"),
  autostartSet: (enabled: boolean) => invoke<void>("autostart_set", { enabled }),
  openLauncherDir: () => invoke<void>("launcher_dir"),
};

export function on<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, (e) => cb(e.payload));
}

export function errorText(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

export const STAGE_NAMES: Record<string, string> = {
  libraries: "Загрузка игры",
  assets: "Загрузка ресурсов",
  java: "Загрузка Java",
  loader: "Установка загрузчика модов",
  mods: "Загрузка модов",
  modpack: "Загрузка модпака",
};

export const LOADER_NAMES: Record<Loader, string> = {
  vanilla: "Без модов",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} млн`;
  if (n >= 1000) return `${Math.round(n / 1000)} тыс.`;
  return String(n);
}

/** Reads a picked file as a data URL. */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
