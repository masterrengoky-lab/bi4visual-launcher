import { useEffect, useState } from "react";
import { api, on, errorText, STAGE_NAMES, type Accounts, type GameState, type Progress, type Settings } from "./lib/api";
import TitleBar from "./components/TitleBar";
import AccountsModal from "./components/AccountsModal";
import VersionsModal from "./components/VersionsModal";
import SettingsModal from "./components/SettingsModal";
import LogModal from "./components/LogModal";
import Avatar from "./components/Avatar";
import { versionLabel } from "./lib/versions";

type ModalName = "accounts" | "versions" | "settings" | "log" | null;

const MAX_LOG = 2000;

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [game, setGame] = useState<GameState["state"]>("stopped");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.accounts().then(setAccounts);
    const subs = [
      on<Progress>("progress", setProgress),
      on<string>("game-log", (line) => setLog((l) => (l.length >= MAX_LOG ? [...l.slice(-MAX_LOG / 2), line] : [...l, line]))),
      on<GameState>("game-state", (s) => {
        setGame(s.state);
        if (s.state !== "installing") setProgress(null);
        if (s.state === "stopped" && s.code !== null && s.code !== 0) {
          setError(`Игра закрылась с ошибкой (код ${s.code}).`);
        }
      }),
    ];
    return () => subs.forEach((p) => p.then((off) => off()));
  }, []);

  const account = accounts?.accounts.find((a) => a.id === accounts.selected) ?? null;

  async function play() {
    setError(null);
    if (!account) {
      setModal("accounts");
      return;
    }
    setLog([]);
    try {
      await api.play();
      // The first Play picks the latest release; show it.
      setSettings(await api.getSettings());
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function updateSettings(next: Settings) {
    setSettings(next);
    await api.saveSettings(next);
  }

  const busy = game !== "stopped";
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden />
      <TitleBar />

      <header className="topbar">
        <button className="account-chip" onClick={() => setModal("accounts")}>
          {account ? (
            <>
              <Avatar uuid={account.uuid} name={account.name} />
              <span className="account-text">
                <b>{account.name}</b>
                <small>{account.kind === "microsoft" ? "Microsoft" : "Без пароля"}</small>
              </span>
            </>
          ) : (
            <span className="account-text">
              <b>Войти</b>
              <small>Добавьте аккаунт</small>
            </span>
          )}
        </button>
        <button className="icon-btn" title="Настройки" onClick={() => setModal("settings")}>
          <GearIcon />
        </button>
      </header>

      <main className="hero">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <h1>bi4visual</h1>
      </main>

      <footer className="play-area">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            {log.length > 0 && <button onClick={() => setModal("log")}>Журнал</button>}
            <button onClick={() => setError(null)} aria-label="Закрыть">✕</button>
          </div>
        )}
        <button className="play-btn" disabled={busy} onClick={play}>
          {game === "running" ? "Игра запущена" : game === "installing" ? "Подготовка…" : "Играть"}
        </button>
        {progress && game === "installing" ? (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${percent ?? 0}%` }} />
            <span>
              {STAGE_NAMES[progress.stage] ?? progress.stage}
              {percent !== null && ` · ${percent}%`}
            </span>
          </div>
        ) : (
          <button className="version-btn" disabled={busy} onClick={() => setModal("versions")}>
            {settings?.last_version ? `Версия ${versionLabel(settings.last_version)}` : "Последняя версия"} ▾
          </button>
        )}
      </footer>

      {modal === "accounts" && accounts && (
        <AccountsModal accounts={accounts} onChange={setAccounts} onClose={() => setModal(null)} />
      )}
      {modal === "versions" && settings && (
        <VersionsModal
          settings={settings}
          onPick={(id) => {
            updateSettings({ ...settings, last_version: id });
            setModal(null);
          }}
          onSettings={updateSettings}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "settings" && settings && (
        <SettingsModal settings={settings} onSave={updateSettings} onClose={() => setModal(null)} />
      )}
      {modal === "log" && <LogModal lines={log} onClose={() => setModal(null)} />}
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
