import { useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorText, readAsDataUrl, type Settings } from "../lib/api";
import { LANGS, useT } from "../lib/i18n";
import type { Shared } from "../App";
import { Toggle } from "./Catalog";
import * as I from "../components/Icons";

const MEMORY_STEPS = [2048, 3072, 4096, 6144, 8192, 12288, 16384];

function memoryIndex(mb: number) {
  const i = MEMORY_STEPS.findIndex((m) => m >= mb);
  return i === -1 ? MEMORY_STEPS.length - 1 : i;
}

/** Every change is saved right away. */
export default function SettingsPage(sh: Shared) {
  const { t } = useT();
  const s = sh.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => sh.saveSettings({ ...s, [k]: v });
  const num = (v: string) => (v.trim() === "" ? null : Math.max(1, Number(v) || 0));
  const file = useRef<HTMLInputElement>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);

  async function pickBackground(f: File | undefined) {
    if (!f) return;
    setBgError(null);
    setBgBusy(true);
    try {
      sh.setBackground(await api.setBackground(await readAsDataUrl(f)));
    } catch (e) {
      setBgError(errorText(e));
    } finally {
      setBgBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className="page-pad settings scroll">
      <div className="page-head">
        <h1>{t("set.title")}</h1>
      </div>

      <section className="card set-section">
        <h3><I.Globe size={18} /> {t("set.language")}</h3>
        <div className="seg">
          {LANGS.map((l) => (
            <button key={l.id} className={s.language === l.id ? "active" : ""} onClick={() => set("language", l.id)}>{l.name}</button>
          ))}
        </div>
      </section>

      <section className="card set-section">
        <h3><I.Play size={18} /> {t("set.game")}</h3>
        <label className="field">
          <small className="label">{t("set.memory")}: {(s.memory_mb / 1024).toFixed(s.memory_mb % 1024 ? 1 : 0)} GB</small>
          <input type="range" min={0} max={MEMORY_STEPS.length - 1} value={memoryIndex(s.memory_mb)} onChange={(e) => set("memory_mb", MEMORY_STEPS[Number(e.target.value)])} />
        </label>
        <div className="row">
          <label className="field grow">
            <small className="label">{t("set.width")}</small>
            <input className="input" placeholder="854" value={s.width ?? ""} onChange={(e) => set("width", num(e.target.value))} />
          </label>
          <label className="field grow">
            <small className="label">{t("set.height")}</small>
            <input className="input" placeholder="480" value={s.height ?? ""} onChange={(e) => set("height", num(e.target.value))} />
          </label>
        </div>
        <div className="set-row"><span>{t("set.fullscreen")}</span><Toggle on={s.fullscreen} onChange={(v) => set("fullscreen", v)} /></div>
        <div className="set-row"><span>{t("set.hide")}</span><Toggle on={s.hide_on_launch} onChange={(v) => set("hide_on_launch", v)} /></div>
        <div className="set-row"><span>{t("set.snapshots")}</span><Toggle on={s.show_snapshots} onChange={(v) => set("show_snapshots", v)} /></div>
        <label className="field">
          <small className="label">{t("set.java")}</small>
          <input className="input" placeholder={t("set.javaAuto")} value={s.java_path ?? ""} onChange={(e) => set("java_path", e.target.value || null)} />
        </label>
        <label className="field">
          <small className="label">{t("set.jvm")}</small>
          <input className="input" placeholder="-XX:+UseG1GC" value={s.extra_jvm_args} onChange={(e) => set("extra_jvm_args", e.target.value)} />
        </label>
      </section>

      <section className="card set-section">
        <h3><I.Image size={18} /> {t("set.look")}</h3>
        <div className="bg-picker">
          <div className="bg-thumb" style={sh.background ? { backgroundImage: `url("${sh.background}")` } : undefined}>
            {!sh.background && <span>{t("set.bgReset")}</span>}
          </div>
          <div className="grow">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickBackground(e.target.files?.[0])} />
            <div className="row">
              <button className="btn primary" disabled={bgBusy} onClick={() => file.current?.click()}>{bgBusy ? t("common.loading") : t("set.bgPick")}</button>
              {sh.background && (
                <button className="btn" onClick={async () => { await api.clearBackground(); sh.setBackground(null); }}>{t("set.bgReset")}</button>
              )}
            </div>
            <label className="field">
              <small className="label">{t("set.bgDim")}: {s.bg_dim}%</small>
              <input type="range" min={0} max={90} value={s.bg_dim} onChange={(e) => set("bg_dim", Number(e.target.value))} />
            </label>
            <label className="field">
              <small className="label">{t("set.bgBlur")}: {s.bg_blur} px</small>
              <input type="range" min={0} max={20} value={s.bg_blur} onChange={(e) => set("bg_blur", Number(e.target.value))} />
            </label>
            <div className="set-row"><span>{t("set.particles")}</span><Toggle on={s.particles} onChange={(v) => set("particles", v)} /></div>
            {bgError && <div className="note err">{bgError}</div>}
          </div>
        </div>
      </section>

      <section className="card set-section">
        <h3><I.Palette size={18} /> {t("set.visuals")}</h3>
        <div className="set-row"><span>{t("set.lyrics")}</span><Toggle on={s.lyrics} onChange={(v) => set("lyrics", v)} /></div>
        <div className="set-row">
          <span>{t("set.sky")}</span>
          <div className="seg small">
            {(["galaxy", "aurora", "both", "off"] as const).map((k) => (
              <button key={k} className={s.sky === k ? "active" : ""} onClick={() => set("sky", k)}>
                {t(k === "galaxy" ? "set.skyGalaxy" : k === "aurora" ? "set.skyAurora" : k === "both" ? "set.skyBoth" : "set.skyOff")}
              </button>
            ))}
          </div>
        </div>
        <div className="set-row"><span>{t("set.night")}</span><Toggle on={s.always_night} onChange={(v) => set("always_night", v)} /></div>
      </section>

      <section className="card set-section">
        <h3><I.Puzzle size={18} /> {t("set.sources")}</h3>
        <label className="field">
          <small className="label">{t("set.cfKey")}</small>
          <input className="input" type="password" placeholder="$2a$10$…" value={s.curseforge_key ?? ""} onChange={(e) => set("curseforge_key", e.target.value || null)} />
        </label>
        <button className="link" onClick={() => openUrl("https://console.curseforge.com/")}>{t("set.cfHint")}</button>
      </section>

      <section className="card set-section about">
        <img src="/logo.svg" alt="" width={40} height={40} />
        <span>
          <b>KissLauncherVis</b>
          <small>{t("set.about")} · v{__APP_VERSION__}</small>
        </span>
        <button className="btn" onClick={sh.openLog}><I.Bug size={16} /> {t("common.log")}</button>
      </section>
    </div>
  );
}
