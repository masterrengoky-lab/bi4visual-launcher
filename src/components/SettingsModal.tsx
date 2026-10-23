import { useRef, useState } from "react";
import { api, errorText, readAsDataUrl, type Settings } from "../lib/api";
import Modal from "./Modal";

type Props = {
  settings: Settings;
  background: string | null;
  onBackground: (url: string | null) => void;
  onSave: (s: Settings) => void;
  onClose: () => void;
};

const MEMORY_STEPS = [2048, 3072, 4096, 6144, 8192, 12288, 16384];

export default function SettingsModal({ settings, background, onBackground, onSave, onClose }: Props) {
  const [s, setS] = useState(settings);
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  /** Look settings apply right away so the user sees the result. */
  function live<K extends "bg_dim" | "bg_blur" | "particles">(k: K, v: Settings[K]) {
    setS((cur) => ({ ...cur, [k]: v }));
    onSave({ ...settings, [k]: v });
  }

  async function pickBackground(f: File | undefined) {
    if (!f) return;
    setBgError(null);
    setBgBusy(true);
    try {
      onBackground(await api.setBackground(await readAsDataUrl(f)));
    } catch (e) {
      setBgError(errorText(e));
    } finally {
      setBgBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function clearBackground() {
    await api.clearBackground();
    onBackground(null);
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Math.max(1, Number(v) || 0));

  function save() {
    onSave(s);
    onClose();
  }

  return (
    <Modal title="Настройки" onClose={onClose} wide>
      <section className="settings-section">
        <h3>Оформление</h3>
        <div className="bg-picker">
          <div className="bg-thumb" style={background ? { backgroundImage: `url("${background}")` } : undefined}>
            {!background && <span>Стандартный фон</span>}
          </div>
          <div className="bg-controls">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pickBackground(e.target.files?.[0])} />
            <div className="row">
              <button className="btn primary" disabled={bgBusy} onClick={() => file.current?.click()}>
                {bgBusy ? "Загружаю…" : "Выбрать картинку…"}
              </button>
              {background && <button className="btn" onClick={clearBackground}>Вернуть стандартный</button>}
            </div>
            <label className="field">
              <span>Затемнение: {s.bg_dim}%</span>
              <input type="range" min={0} max={90} value={s.bg_dim} onChange={(e) => live("bg_dim", Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Размытие: {s.bg_blur} px</span>
              <input type="range" min={0} max={20} value={s.bg_blur} onChange={(e) => live("bg_blur", Number(e.target.value))} />
            </label>
            <label className="check">
              <input type="checkbox" checked={s.particles} onChange={(e) => live("particles", e.target.checked)} />
              Летающие искры
            </label>
            {bgError && <p className="error-text">{bgError}</p>}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h3>Игра</h3>
      <label className="field">
        <span>Память для игры: {(s.memory_mb / 1024).toFixed(s.memory_mb % 1024 ? 1 : 0)} ГБ</span>
        <input
          type="range"
          min={0}
          max={MEMORY_STEPS.length - 1}
          value={memoryIndex(s.memory_mb)}
          onChange={(e) => set("memory_mb", MEMORY_STEPS[Number(e.target.value)])}
        />
      </label>

      <div className="field">
        <span>Размер окна (пусто — по умолчанию)</span>
        <div className="row">
          <input className="input" placeholder="Ширина" value={s.width ?? ""} onChange={(e) => set("width", num(e.target.value))} />
          <input className="input" placeholder="Высота" value={s.height ?? ""} onChange={(e) => set("height", num(e.target.value))} />
          <label className="check">
            <input type="checkbox" checked={s.fullscreen} onChange={(e) => set("fullscreen", e.target.checked)} />
            Полный экран
          </label>
        </div>
      </div>

      <label className="check">
        <input type="checkbox" checked={s.hide_on_launch} onChange={(e) => set("hide_on_launch", e.target.checked)} />
        Скрывать лаунчер во время игры
      </label>

      <details>
        <summary>Для опытных</summary>
        <label className="field">
          <span>Своя Java (путь к java или javaw.exe; пусто — скачается сама)</span>
          <input className="input" value={s.java_path ?? ""} onChange={(e) => set("java_path", e.target.value || null)} />
        </label>
        <label className="field">
          <span>Дополнительные аргументы JVM</span>
          <input className="input" value={s.extra_jvm_args} onChange={(e) => set("extra_jvm_args", e.target.value)} />
        </label>
      </details>

      </section>

      <div className="row end">
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn primary" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}

function memoryIndex(mb: number) {
  const i = MEMORY_STEPS.findIndex((m) => m >= mb);
  return i === -1 ? MEMORY_STEPS.length - 1 : i;
}
