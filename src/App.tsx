import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, on, errorText, type Accounts, type GameState, type Instances, type Lang, type Progress, type Settings, type Skin } from "./lib/api";
import { I18n, translator, type Key } from "./lib/i18n";
import * as I from "./components/Icons";
import AccountsModal from "./components/AccountsModal";
import LogModal from "./components/LogModal";
import Home from "./pages/Home";
import Cosmetics from "./pages/Cosmetics";
import Skins from "./pages/Skins";
import Catalog from "./pages/Catalog";
import Builds from "./pages/Builds";
import Friends from "./pages/Friends";
import SettingsPage from "./pages/Settings";

export type Page = "home" | "cosmetics" | "skins" | "mods" | "packs" | "builds" | "friends" | "settings";

const NAV: { id: Page; key: Key; icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "home", key: "nav.home", icon: I.Home },
  { id: "cosmetics", key: "nav.cosmetics", icon: I.Palette },
  { id: "skins", key: "nav.skins", icon: I.User },
  { id: "mods", key: "nav.mods", icon: I.Puzzle },
  { id: "packs", key: "nav.packs", icon: I.Image },
  { id: "builds", key: "nav.builds", icon: I.Layers },
  { id: "friends", key: "nav.friends", icon: I.Users },
];

const MAX_LOG = 2000;

/** Everything the pages share. */
export type Shared = {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  accounts: Accounts;
  setAccounts: (a: Accounts) => void;
  instances: Instances;
  setInstances: (i: Instances) => void;
  skin: Skin | null;
  reloadSkin: () => void;
  background: string | null;
  setBackground: (b: string | null) => void;
  game: GameState["state"];
  progress: Progress | null;
  play: () => void;
  openAccounts: () => void;
  openLog: () => void;
  go: (p: Page) => void;
};

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [instances, setInstances] = useState<Instances | null>(null);
  const [skin, setSkin] = useState<Skin | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("home");
  const [modal, setModal] = useState<"accounts" | "log" | null>(null);
  const [game, setGame] = useState<GameState["state"]>("stopped");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const lang: Lang = settings?.language ?? "ru";
  const i18n = useMemo(() => ({ t: translator(lang), lang }), [lang]);
  const { t } = i18n;

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.accounts().then(setAccounts);
    api.instances().then(setInstances);
    api.background().then(setBackground, () => {});
    const subs = [
      on<Progress>("progress", setProgress),
      on<string>("game-log", (line) => setLog((l) => (l.length >= MAX_LOG ? [...l.slice(-MAX_LOG / 2), line] : [...l, line]))),
      on<GameState>("game-state", (s) => {
        setGame(s.state);
        if (s.state !== "installing") setProgress(null);
        if (s.state === "stopped") api.instances().then(setInstances);
        if (s.state === "stopped" && s.code !== null && s.code !== 0) setError(`crash:${s.code}`);
      }),
    ];
    return () => subs.forEach((p) => p.then((off) => off()));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const account = accounts?.accounts.find((a) => a.id === accounts.selected) ?? null;
  const reloadSkin = useCallback(() => {
    if (!account) return setSkin(null);
    api.skin(account.id).then(setSkin, () => setSkin(null));
  }, [account?.id, account?.custom_skin, accounts]);
  useEffect(reloadSkin, [reloadSkin]);

  async function play() {
    setError(null);
    if (!account) return setModal("accounts");
    setLog([]);
    try {
      await api.play();
      setInstances(await api.instances());
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function saveSettings(next: Settings) {
    setSettings(next);
    await api.saveSettings(next);
  }

  if (!settings || !accounts || !instances) {
    return (
      <div className="app loading">
        <WindowButtons />
      </div>
    );
  }

  const shared: Shared = {
    settings,
    saveSettings,
    accounts,
    setAccounts,
    instances,
    setInstances,
    skin,
    reloadSkin,
    background,
    setBackground,
    game,
    progress,
    play,
    openAccounts: () => setModal("accounts"),
    openLog: () => setModal("log"),
    go: setPage,
  };

  return (
    <I18n.Provider value={i18n}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand" data-tauri-drag-region>
            <img src="/logo.svg" alt="" width={38} height={38} />
            <span>KissLauncher<em>Vis</em></span>
          </div>
          <nav className="nav">
            {NAV.map((n) => (
              <button key={n.id} className={`nav-item${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}>
                <n.icon size={21} />
                {t(n.key)}
              </button>
            ))}
          </nav>
          <div className="nav-bottom">
            <button className={`nav-item${page === "settings" ? " active" : ""}`} onClick={() => setPage("settings")}>
              <I.Gear size={21} />
              {t("nav.settings")}
            </button>
          </div>
        </aside>

        <main className={`page page-${page}`} key={page}>
          <div className="drag-strip" data-tauri-drag-region />
          {page === "home" && <Home {...shared} />}
          {page === "cosmetics" && <Cosmetics {...shared} />}
          {page === "skins" && <Skins {...shared} />}
          {page === "mods" && <Catalog {...shared} kind="mod" />}
          {page === "packs" && <Catalog {...shared} kind="resourcepack" />}
          {page === "builds" && <Builds {...shared} />}
          {page === "friends" && <Friends {...shared} />}
          {page === "settings" && <SettingsPage {...shared} />}
        </main>

        <WindowButtons />

        {error && (
          <div className="toast error" role="alert">
            <span>{error.startsWith("crash:") ? t("home.crashed", { code: error.slice(6) }) : error}</span>
            {log.length > 0 && <button className="btn small" onClick={() => setModal("log")}>{t("common.log")}</button>}
            <button className="icon-btn" onClick={() => setError(null)} aria-label={t("common.close")}><I.X size={16} /></button>
          </div>
        )}

        {modal === "accounts" && <AccountsModal accounts={accounts} onChange={setAccounts} onClose={() => setModal(null)} />}
        {modal === "log" && <LogModal lines={log} onClose={() => setModal(null)} />}
      </div>
    </I18n.Provider>
  );
}

function WindowButtons() {
  const win = getCurrentWindow();
  return (
    <div className="window-buttons">
      <button onClick={() => win.minimize()} aria-label="minimize">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
      <button onClick={() => win.toggleMaximize()} aria-label="maximize">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
      <button className="close" onClick={() => win.close()} aria-label="close">
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.2" /></svg>
      </button>
    </div>
  );
}
