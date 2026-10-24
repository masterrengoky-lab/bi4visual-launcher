import React, { useCallback, useEffect, useRef, useState } from "react";
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
import SettingsPage from "./components/SettingsPage";
import LogModal from "./components/LogModal";
import InstancesPanel from "./components/InstancesPanel";
import ModsPanel from "./components/ModsPanel";
import ModpacksPanel from "./components/ModpacksPanel";
import SkinPage from "./components/SkinPage";
import FeaturedPacks from "./components/FeaturedPacks";
import SkinFront from "./components/SkinFront";
import { BookArt, ChestArt, GrassBlockArt } from "./components/PixelArt";
import { EMOTES, type EmoteKind } from "./lib/livelyAnimation";
import { applyTheme } from "./lib/theme";
import { setUiSounds } from "./lib/sounds";
import { useMusic } from "./lib/useMusic";

type ModalName = "accounts" | "log" | "instances" | "mods" | "modpacks" | null;
type PageName = "lobby" | "settings" | "skin";

const MAX_LOG = 2000;

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [accounts, setAccounts] = useState<Accounts | null>(null);
  const [instances, setInstances] = useState<Instances | null>(null);
  const [skin, setSkin] = useState<Skin | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [page, setPage] = useState<PageName>("lobby");
  const [game, setGame] = useState<GameState["state"]>("stopped");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [emote, setEmote] = useState<{ kind: EmoteKind; n: number } | null>(null);
  const [emoteMenu, setEmoteMenu] = useState(false);

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
        if (s.state === "stopped" && s.code !== null && s.code !== 0) {
          setError(`Игра закрылась с ошибкой (код ${s.code}).`);
        }
      }),
    ];
    return () => subs.forEach((p) => p.then((off) => off()));
  }, []);

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings);
    setUiSounds(settings.ui_sounds);
  }, [settings?.accent, settings?.ui_scale, settings?.ui_sounds]);
  const music = useMusic(settings?.music ?? false, settings?.music_autoplay ?? false, settings?.music_volume ?? 40);

  const stageRef = useRef<HTMLElement>(null);
  const [stageSize, setStageSize] = useState({ w: 380, h: 400 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageSize({ w: Math.floor(e.contentRect.width), h: Math.max(200, Math.floor(e.contentRect.height)) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const account = accounts?.accounts.find((a) => a.id === accounts.selected) ?? null;
  const instance = instances?.instances.find((i) => i.id === instances.selected) ?? null;

  const reloadSkin = useCallback(() => {
    if (!account) return setSkin(null);
    api.skin(account.id).then(setSkin, () => setSkin(null));
  }, [account?.id, account?.custom_skin, accounts]);
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
      <Backdrop
        image={background}
        dim={settings?.bg_dim ?? 45}
        blur={settings?.bg_blur ?? 3}
        particles={settings?.particles ?? true}
        preset={settings?.bg_preset ?? "scene"}
      />
      <TitleBar />

      <div className="layout">
        <nav className="side">
          <Tile title="Сборки" color="violet" onClick={() => setModal("instances")}>
            <ChestArt className="tile-art chest" />
          </Tile>
          <Tile title="Мой скин" color="blue" onClick={() => setPage("skin")}>
            <SkinFront className="tile-art skin" skin={skin?.data_url ?? null} slim={skin?.slim ?? false} />
          </Tile>
          <Tile title="Моды" color="green" onClick={() => setModal("mods")}>
            <BookArt className="tile-art book" />
          </Tile>
          <Tile title="Модпаки" color="orange" onClick={() => setModal("modpacks")}>
            <GrassBlockArt className="tile-art grass" />
          </Tile>
        </nav>

        <header className="topbar">
          <button className="hud account-chip" onClick={() => setModal("accounts")}>
            {account ? (
              <>
                <Avatar uuid={account.uuid} name={account.name} />
                <span className="account-text">
                  <b>{account.name}</b>
                  <small>{account.kind === "microsoft" ? "Лицензия" : "Офлайн-ник"}</small>
                </span>
              </>
            ) : (
              <span className="account-text">
                <b>Войти</b>
                <small>Добавьте аккаунт</small>
              </span>
            )}
            <span className="chevron">⌄</span>
          </button>
          <button className="hud square" title="Журнал игры" onClick={() => setModal("log")}>
            <BugIcon />
          </button>
          <button className="hud square" title="Настройки" onClick={() => setPage("settings")}>
            <GearIcon />
          </button>
        </header>

        <main className="stage" ref={stageRef}>
          <div className="stage-glow" aria-hidden />
          <SkinViewer
            skin={skin?.data_url ?? null}
            slim={skin?.slim ?? false}
            width={Math.min(420, stageSize.w)}
            height={stageSize.h}
            walking={game === "installing"}
            cosmetics={settings?.cosmetics}
            emote={emote}
          />
          <div className="emote-dock">
            {emoteMenu && (
              <div className="emote-menu">
                {EMOTES.map((e) => (
                  <button
                    key={e.kind}
                    onClick={() => {
                      setEmote((cur) => ({ kind: e.kind, n: (cur?.n ?? 0) + 1 }));
                      setEmoteMenu(false);
                    }}
                  >
                    <span>{e.icon}</span>
                    {e.name}
                  </button>
                ))}
              </div>
            )}
            <button className="hud square emote-btn" title="Эмоции" onClick={() => setEmoteMenu((v) => !v)}>
              😀
            </button>
          </div>
        </main>

        <div className="right">
          <FeaturedPacks busy={busy} onInstalled={setInstances} />
        </div>

        <footer className="play-area">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {log.length > 0 && <button onClick={() => setModal("log")}>Журнал</button>}
              <button onClick={() => setError(null)} aria-label="Закрыть">✕</button>
            </div>
          )}
          <div className="quick-row">
            <button className="mc-btn dark" onClick={() => setModal("mods")}>🧩 Моды сборки</button>
            <button className="mc-btn dark" disabled={!instance} onClick={() => instance && api.openInstanceDir(instance.id)}>
              📁 Папка сборки
            </button>
          </div>
          <div className="play-row">
            <button className="instance-card" disabled={busy} onClick={() => setModal("instances")}>
              <InstanceIcon instance={instance} size={84} />
              <span className="instance-text">
                <small>▤ Сборка</small>
                <b>{instance?.name ?? "Последняя версия"}</b>
                <span>{instance ? `${instance.game_version} · ${LOADER_NAMES[instance.loader]}` : "Создастся при первом запуске"}</span>
              </span>
            </button>
            <div className="play-col">
              <button className="play-btn" disabled={busy} onClick={play}>
                <span className="play-main">
                  <span className="play-icon">▶</span>
                  {game === "running" ? "В игре" : game === "installing" ? "Загрузка" : "Играть"}
                </span>
                {progress && game === "installing" ? (
                  <span className="play-progress">
                    <span className="play-progress-bar" style={{ width: `${percent ?? 0}%` }} />
                  </span>
                ) : (
                  <span className="play-sub">{formatPlaytime(instance?.playtime_secs ?? 0)}</span>
                )}
              </button>
              <div className="play-status">
                {progress && game === "installing"
                  ? `${STAGE_NAMES[progress.stage] ?? progress.stage}${percent !== null && progress.total > 1 ? ` · ${percent}%` : ""}`
                  : game === "running"
                    ? "Игра запущена"
                    : "\u00a0"}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {modal === "accounts" && accounts && <AccountsModal accounts={accounts} onChange={setAccounts} onClose={close} />}
      {page === "settings" && settings && (
        <SettingsPage
          settings={settings}
          background={background}
          account={account}
          music={music}
          log={log}
          onBackground={setBackground}
          onSave={updateSettings}
          onAccounts={() => setModal("accounts")}
          onClose={() => setPage("lobby")}
        />
      )}
      {page === "skin" && (
        <SkinPage
          account={account}
          skin={skin}
          cosmetics={settings?.cosmetics ?? []}
          onCosmetics={(c) => settings && updateSettings({ ...settings, cosmetics: c })}
          onChanged={(a) => (a ? setAccounts(a) : reloadSkin())}
          onAccounts={() => setModal("accounts")}
          onClose={() => setPage("lobby")}
        />
      )}
      {modal === "log" && <LogModal lines={log} onClose={close} />}
      {modal === "instances" && instances && settings && (
        <InstancesPanel
          instances={instances}
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
    </div>
  );
}

function Tile({ title, color, onClick, children }: { title: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`tile tile-${color}`} onClick={onClick}>
      <span className="tile-art-wrap">{children}</span>
      <span className="tile-label">{title}</span>
    </button>
  );
}

function formatPlaytime(secs: number): string {
  if (secs < 60) return "ещё не играли";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

function BugIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x="6" y="2" width="4" height="2" />
      <rect x="4" y="4" width="8" height="9" />
      <rect x="2" y="5" width="2" height="1" /><rect x="12" y="5" width="2" height="1" />
      <rect x="1" y="8" width="3" height="1" /><rect x="12" y="8" width="3" height="1" />
      <rect x="2" y="11" width="2" height="1" /><rect x="12" y="11" width="2" height="1" />
      <rect x="7.5" y="5" width="1" height="7" fill="#17151f" />
    </svg>
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
