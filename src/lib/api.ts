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
  language: Lang;
  curseforge_key: string | null;
};

export type Lang = "ru" | "en" | "uk";
export type Source = "modrinth" | "curseforge";
export type Kind = "mod" | "modpack" | "resourcepack";
export type Sort = "relevance" | "downloads" | "updated" | "newest";
export type PackFile = { file_name: string; enabled: boolean };
export type Friend = { name: string; uuid: string | null; note: string; added: number };
export type SavedSkin = { id: string; name: string; slim: boolean; added: number; data_url: string };

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
  mods: { project_id: string; file_name: string; title: string }[];
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
  search: (source: Source, query: string, kind: Kind, instance: string | null, sort: Sort, offset = 0) =>
    invoke<SearchResult>("catalog_search", { source, query, kind, instance, sort, offset }),
  install: (kind: Kind, instance: string, project: string) => invoke<string[]>("catalog_install", { kind, instance, project }),
  installPack: (project: string) => invoke<Instances>("modrinth_install_pack", { project }),
  renameInstance: (id: string, name: string) => invoke<Instances>("instance_rename", { id, name }),
  duplicateInstance: (id: string) => invoke<Instances>("instance_duplicate", { id }),

  packs: (instance: string) => invoke<PackFile[]>("resourcepacks_list", { instance }),
  togglePack: (instance: string, file: string, enabled: boolean) => invoke<void>("resourcepack_toggle", { instance, file, enabled }),
  removePack: (instance: string, file: string) => invoke<void>("resourcepack_remove", { instance, file }),

  savedSkins: () => invoke<SavedSkin[]>("skin_library_list"),
  saveSkin: (name: string, png: number[], slim: boolean) => invoke<SavedSkin[]>("skin_library_add", { name, png, slim }),
  saveSkinOf: (name: string) => invoke<SavedSkin[]>("skin_library_add_name", { name }),
  removeSavedSkin: (id: string) => invoke<SavedSkin[]>("skin_library_remove", { id }),
  applySavedSkin: (account: string, id: string) => invoke<Accounts>("skin_apply_saved", { account, id }),
  applySkinOf: (account: string, name: string) => invoke<Accounts>("skin_apply_name", { account, name }),

  friends: () => invoke<Friend[]>("friends_list"),
  addFriend: (name: string) => invoke<Friend[]>("friend_add", { name }),
  removeFriend: (name: string) => invoke<Friend[]>("friend_remove", { name }),

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
};

export function on<T>(event: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, (e) => cb(e.payload));
}

export function errorText(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}

export function formatCount(n: number, lang: Lang): string {
  const [m, k] = lang === "en" ? ["M", "K"] : lang === "uk" ? ["млн", "тис."] : ["млн", "тыс."];
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}${lang === "en" ? "" : " "}${m}`;
  if (n >= 1000) return `${Math.round(n / 1000)}${lang === "en" ? "" : " "}${k}`;
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

export async function readBytes(file: File): Promise<number[]> {
  return Array.from(new Uint8Array(await file.arrayBuffer()));
}
