import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Settings = {
  memory_mb: number;
  java_path: string | null;
  game_dir: string | null;
  extra_jvm_args: string;
  width: number | null;
  height: number | null;
  fullscreen: boolean;
  hide_on_launch: boolean;
  last_version: string | null;
  show_snapshots: boolean;
};

export type Account = { id: string; kind: "offline" | "microsoft"; name: string; uuid: string };
export type Accounts = { accounts: Account[]; selected: string | null; microsoft_available: boolean };
export type VersionItem = { id: string; kind: string; installed: boolean };
export type VersionList = { latest: string | null; online: boolean; versions: VersionItem[] };
export type DeviceCode = { user_code: string; verification_uri: string; expires_in: number };
export type Progress = { stage: string; done: number; total: number };
export type GameState = { state: "installing" | "running" | "stopped"; code: number | null };

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  defaultGameDir: () => invoke<string>("default_game_dir"),
  openGameDir: () => invoke<void>("open_game_dir"),

  listVersions: () => invoke<VersionList>("list_versions"),
  fabricLoaders: (game: string) => invoke<string[]>("fabric_loaders", { game }),
  addFabric: (game: string, loader: string) => invoke<string>("add_fabric", { game, loader }),
  installVersion: (id: string) => invoke<void>("install_version", { id }),
  deleteVersion: (id: string) => invoke<void>("delete_version", { id }),

  accounts: () => invoke<Accounts>("accounts_list"),
  addOffline: (name: string) => invoke<Accounts>("account_add_offline", { name }),
  selectAccount: (id: string) => invoke<Accounts>("account_select", { id }),
  removeAccount: (id: string) => invoke<Accounts>("account_remove", { id }),
  msStart: () => invoke<DeviceCode>("ms_login_start"),
  msFinish: () => invoke<Accounts>("ms_login_finish"),

  play: () => invoke<void>("play"),
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
};
