import { useCallback, useEffect, useState } from "react";
import {
  api,
  on,
  errorText,
  LOADER_NAMES,
  STAGE_NAMES,
  type Accounts,
  type GameState,
  type Instances,
  type Progress,
  type Settings,
  type Skin,
} from "./lib/api";
import TitleBar from "./components/TitleBar";
import Backdrop from "./components/Backdrop";
import SkinViewer from "./components/SkinViewer";
import Avatar from "./components/Avatar";
import InstanceIcon from "./components/InstanceIcon";
import AccountsModal from "./components/AccountsModal";
import SettingsModal from "./components/SettingsModal";
import LogModal from "./components/LogModal";
import InstancesPanel from "./components/InstancesPanel";
import ModsPanel from "./components/ModsPanel";
import ModpacksPanel from "./components/ModpacksPanel";
import SkinPanel from "./components/SkinPanel";

type ModalName = "accounts" | "settings" | "log" | "instances" | "mods" | "modpacks" | "skin" | null;

const MAX_LOG = 2000;

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [instances, setInstances] = useState<Instances | null>(null);
  const [skin, setSkin] = useState<Skin | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [game, setGame] = useState<GameState["state"]>("stopped");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.accounts().then(setAccounts);
    api.instances().then(setInstances);
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
  const instance = instances?.instances.find((i) => i.id === instances.selected) ?? null;

  const reloadSkin = useCallback(() => {
    if (!account) return setSkin(null);
    api.skin(account.id).then(setSkin, () => setSkin(null));
  }, [account?.id]);
  useEffect(reloadSkin, [reloadSkin]);

  async function play() {
    setError(null);
    if (!account) {
      setModal("accounts");
      return;
    }
    setLog([]);
    try {
      await api.play();
      // The very first Play creates an instance; show it.
      setInstances(await api.instances());
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
  const close = () => setModal(null);

  return (
    <div className="app">
      <Backdrop />
      <TitleBar />

      <div className="layout">
        <nav className="side">
          <Tile icon="📦" title="Сборки" hint="Версии и загрузчики" color="violet" onClick={() => setModal("instances")} />
          <Tile icon="🧩" title="Моды" hint="Каталог Modrinth" color="green" onClick={() => setModal("mods")} />
          <Tile icon="🗺️" title="Модпаки" hint="Готовые сборки" color="orange" onClick={() => setModal("modpacks")} />
          <Tile icon="👕" title="Скин" hint="Внешний вид" color="blue" onClick={() => setModal("skin")} />
        </nav>

        <header className="topbar">
          <button className="account-chip" onClick={() => setModal("accounts")}>
            {account ? (
              <>
                <Avatar uuid={account.uuid} name={account.name} />
                <span className="account-text">
                  <b>{account.name}</b>
                  <small>{account.kind === "microsoft" ? "Лицензия Microsoft" : "Без пароля"}</small>
                </span>
              </>
            ) : (
              <span className="account-text">
                <b>Войти</b>
                <small>Добавьте аккаунт</small>
              </span>
            )}
            <span className="chevron">▾</span>
          </button>
          <button className="icon-btn" title="Настройки" onClick={() => setModal("settings")}>
            <GearIcon />
          </button>
        </header>

        <main className="stage">
          <div className="stage-glow" aria-hidden />
          <SkinViewer
            skin={skin?.data_url ?? null}
            slim={skin?.slim ?? false}
            name={account?.name}
            width={360}
            height={470}
            walking={game === "installing"}
          />
        </main>

        <footer className="play-area">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {log.length > 0 && <button onClick={() => setModal("log")}>Журнал</button>}
              <button onClick={() => setError(null)} aria-label="Закрыть">✕</button>
            </div>
          )}
          <div className="play-row">
            <button className="instance-card" disabled={busy} onClick={() => setModal("instances")}>
              <InstanceIcon instance={instance} size={56} />
              <span className="instance-text">
                <small>Сборка</small>
                <b>{instance?.name ?? "Последняя версия"}</b>
                <span>{instance ? `${instance.game_version} · ${LOADER_NAMES[instance.loader]}` : "Создастся при первом запуске"}</span>
              </span>
              <span className="chevron">▾</span>
            </button>
            <div className="play-col">
              <button className="play-btn" disabled={busy} onClick={play}>
                <span className="play-icon">▶</span>
                {game === "running" ? "В игре" : game === "installing" ? "Загрузка" : "Играть"}
              </button>
              {progress && game === "installing" && (
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${percent ?? 0}%` }} />
                  <span>
                    {STAGE_NAMES[progress.stage] ?? progress.stage}
                    {percent !== null && progress.total > 1 && ` · ${percent}%`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </footer>
      </div>

      {modal === "accounts" && accounts && <AccountsModal accounts={accounts} onChange={setAccounts} onClose={close} />}
      {modal === "settings" && settings && <SettingsModal settings={settings} onSave={updateSettings} onClose={close} />}
      {modal === "log" && <LogModal lines={log} onClose={close} />}
      {modal === "instances" && instances && settings && (
        <InstancesPanel
          instances={instances}
          showSnapshots={settings.show_snapshots}
          onSnapshots={(v) => updateSettings({ ...settings, show_snapshots: v })}
          onChange={setInstances}
          onClose={close}
        />
      )}
      {modal === "mods" && (
        <ModsPanel instance={instance} onCreate={() => setModal("instances")} onClose={close} />
      )}
      {modal === "modpacks" && (
        <ModpacksPanel
          busy={busy}
          onInstalled={(i) => {
            setInstances(i);
            close();
          }}
          onClose={close}
        />
      )}
      {modal === "skin" && (
        <SkinPanel account={account} skin={skin} onChanged={reloadSkin} onAccounts={() => setModal("accounts")} onClose={close} />
      )}
    </div>
  );
}

function Tile({ icon, title, hint, color, onClick }: { icon: string; title: string; hint: string; color: string; onClick: () => void }) {
  return (
    <button className={`tile tile-${color}`} onClick={onClick}>
      <span className="tile-icon" aria-hidden>{icon}</span>
      <span className="tile-text">
        <b>{title}</b>
        <small>{hint}</small>
      </span>
    </button>
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
