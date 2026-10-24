import { useState } from "react";
import { api } from "../lib/api";
import { LANGS, formatPlaytime, useT, type Key } from "../lib/i18n";
import type { Shared } from "../App";
import Scene from "../components/Scene";
import Avatar from "../components/Avatar";
import InstanceIcon from "../components/InstanceIcon";
import { LOADER_LABEL } from "./Builds";
import * as I from "../components/Icons";

export default function Home(s: Shared) {
  const { t } = useT();
  const { settings, accounts, instances, game, progress } = s;
  const account = accounts.accounts.find((a) => a.id === accounts.selected) ?? null;
  const instance = instances.instances.find((i) => i.id === instances.selected) ?? null;
  const [menu, setMenu] = useState<"lang" | "account" | "instance" | null>(null);

  const busy = game !== "stopped";
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null;
  const status =
    progress && game === "installing"
      ? `${t(`stage.${progress.stage}` as Key)}${percent !== null && progress.total > 1 ? ` · ${percent}%` : ""}`
      : game === "running"
        ? t("home.statusRunning")
        : t("home.statusReady");

  return (
    <div className="home" onClick={() => setMenu(null)}>
      <Scene image={s.background} dim={settings.bg_dim} blur={settings.bg_blur} particles={settings.particles} />

      <header className="home-top">
        <div className="welcome">
          <small>{t("home.welcome")}</small>
          <b>{account?.name ?? t("home.guest")}.</b>
        </div>
        <div className="home-chips" onClick={(e) => e.stopPropagation()}>
          <div className="dropdown">
            <button className="chip" onClick={() => setMenu(menu === "lang" ? null : "lang")}>
              <I.Globe size={18} />
              {LANGS.find((l) => l.id === settings.language)?.short ?? "RU"}
              <I.Chevron size={16} />
            </button>
            {menu === "lang" && (
              <div className="menu">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    className={l.id === settings.language ? "active" : ""}
                    onClick={() => {
                      s.saveSettings({ ...settings, language: l.id });
                      setMenu(null);
                    }}
                  >
                    <b>{l.short}</b> {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="dropdown">
            <button className="chip account" onClick={() => (accounts.accounts.length ? setMenu(menu === "account" ? null : "account") : s.openAccounts())}>
              {account ? <Avatar uuid={account.uuid} name={account.name} /> : <span className="avatar fallback">?</span>}
              <span className="online-dot" />
              {account?.name ?? t("acc.login")}
              <I.Chevron size={16} />
            </button>
            {menu === "account" && (
              <div className="menu wide">
                {accounts.accounts.map((a) => (
                  <button
                    key={a.id}
                    className={a.id === accounts.selected ? "active" : ""}
                    onClick={async () => {
                      s.setAccounts(await api.selectAccount(a.id));
                      setMenu(null);
                    }}
                  >
                    <Avatar uuid={a.uuid} name={a.name} />
                    <span className="menu-text">
                      <b>{a.name}</b>
                      <small>{a.kind === "microsoft" ? t("acc.microsoft") : t("acc.offline")}</small>
                    </span>
                    {a.id === accounts.selected && <I.Check size={16} />}
                  </button>
                ))}
                <div className="menu-sep" />
                <button onClick={() => { setMenu(null); s.openAccounts(); }}>
                  <I.Plus size={18} /> {t("acc.manage")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="hero">
        <h1>
          {t("home.hero1")}
          <br />
          <span>{t("home.hero2")}</span>
        </h1>
        <p>{t("home.ready")}</p>
      </section>

      <footer className="launch-bar" onClick={(e) => e.stopPropagation()}>
        <div className="dropdown up">
          <button className="launch-instance" disabled={busy} onClick={() => setMenu(menu === "instance" ? null : "instance")}>
            <span className="launch-icon"><InstanceIcon instance={instance} size={64} /></span>
            <span className="launch-text">
              <b>{instance?.name ?? t("home.latest")}</b>
              <small>
                {instance ? `Minecraft ${instance.game_version} · ${LOADER_LABEL[instance.loader]}` : t("home.noBuild")}
                {instances.instances.length > 0 && <I.Chevron size={14} />}
              </small>
            </span>
          </button>
          {menu === "instance" && instances.instances.length > 0 && (
            <div className="menu wide up">
              {instances.instances.map((i) => (
                <button
                  key={i.id}
                  className={i.id === instances.selected ? "active" : ""}
                  onClick={async () => {
                    s.setInstances(await api.selectInstance(i.id));
                    setMenu(null);
                  }}
                >
                  <InstanceIcon instance={i} size={30} />
                  <span className="menu-text">
                    <b>{i.name}</b>
                    <small>{i.game_version} · {LOADER_LABEL[i.loader]}</small>
                  </span>
                </button>
              ))}
              <div className="menu-sep" />
              <button onClick={() => s.go("builds")}><I.Layers size={18} /> {t("nav.builds")}</button>
            </div>
          )}
        </div>
        <div className="launch-divider" />
        <div className="launch-status">
          <span className={`status-ring${busy ? " busy" : ""}`}>{busy ? <Spinner /> : <I.Check size={18} />}</span>
          <span>
            {status}
            {!busy && instance && <small>{t("home.playtime", { time: formatPlaytime(t, instance.playtime_secs) })}</small>}
          </span>
        </div>
        <button className="play" disabled={busy} onClick={s.play}>
          {progress && game === "installing" && <span className="play-fill" style={{ width: `${percent ?? 0}%` }} />}
          <span className="play-label">
            <I.Play size={26} />
            {game === "running" ? t("home.inGame") : game === "installing" ? t("home.loading") : t("home.play")}
          </span>
        </button>
      </footer>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 1-9 9" />
    </svg>
  );
}
