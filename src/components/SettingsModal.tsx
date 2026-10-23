import { useState } from "react";
import type { Settings } from "../lib/api";
import Modal from "./Modal";

type Props = { settings: Settings; onSave: (s: Settings) => void; onClose: () => void };

const MEMORY_STEPS = [2048, 3072, 4096, 6144, 8192, 12288, 16384];

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [s, setS] = useState(settings);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Math.max(1, Number(v) || 0));

  function save() {
    onSave(s);
    onClose();
  }

  return (
    <Modal title="Настройки" onClose={onClose}>
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
