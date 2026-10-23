import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errorText, LOADER_NAMES, type Instance, type ModFile } from "../lib/api";
import Modal from "./Modal";
import HitList from "./HitList";

type Props = { instance: Instance | null; onCreate: () => void; onClose: () => void };

export default function ModsPanel({ instance, onCreate, onClose }: Props) {
  const [tab, setTab] = useState<"catalog" | "installed">("catalog");
  const [mods, setMods] = useState<ModFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (instance) api.mods(instance.id).then(setMods, (e) => setError(errorText(e)));
  }, [instance?.id]);
  useEffect(reload, [reload]);

  const installed = useMemo(() => new Set(mods.map((m) => m.project_id).filter(Boolean) as string[]), [mods]);

  if (!instance || instance.loader === "vanilla") {
    return (
      <Modal title="Моды" onClose={onClose}>
        <p>
          {instance ? `Сборка «${instance.name}» без загрузчика модов.` : "Сборки ещё нет."} Чтобы ставить моды, создайте сборку с Fabric, Forge
          или NeoForge.
        </p>
        <div className="row end">
          <button className="btn primary" onClick={onCreate}>Создать сборку</button>
        </div>
      </Modal>
    );
  }

  async function toggle(m: ModFile) {
    await api.toggleMod(instance!.id, m.file_name, !m.enabled).catch((e) => setError(errorText(e)));
    reload();
  }
  async function remove(m: ModFile) {
    await api.removeMod(instance!.id, m.file_name).catch((e) => setError(errorText(e)));
    reload();
  }

  return (
    <Modal title={`Моды · ${instance.name}`} onClose={onClose} large>
      <div className="row between">
        <div className="segmented">
          <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>Каталог</button>
          <button className={tab === "installed" ? "active" : ""} onClick={() => setTab("installed")}>
            Установленные {mods.length > 0 && <span className="badge">{mods.length}</span>}
          </button>
        </div>
        <small className="muted">
          {instance.game_version} · {LOADER_NAMES[instance.loader]}
        </small>
      </div>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {tab === "catalog" ? (
        <HitList
          kind="mod"
          instance={instance.id}
          installed={installed}
          actionLabel="Установить"
          onAction={async (hit) => {
            setNotice(null);
            const added = await api.installMod(instance.id, hit.project_id);
            setNotice(added.length > 1 ? `Установлено: ${added.join(", ")}` : `«${hit.title}» установлен`);
            reload();
          }}
        />
      ) : (
        <ul className="mod-list">
          {mods.length === 0 && <li className="muted">Модов пока нет. Найдите их во вкладке «Каталог».</li>}
          {mods.map((m) => (
            <li key={m.file_name} className={m.enabled ? "" : "off"}>
              {m.icon_url ? <img src={m.icon_url} alt="" className="hit-icon small" /> : <span className="hit-icon small empty" />}
              <span className="grow">
                <b>{m.title}</b>
                <small className="muted"> {m.file_name}</small>
              </span>
              <label className="switch" title={m.enabled ? "Выключить" : "Включить"}>
                <input type="checkbox" checked={m.enabled} onChange={() => toggle(m)} />
                <span />
              </label>
              <button className="icon-btn small" title="Удалить" onClick={() => remove(m)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
