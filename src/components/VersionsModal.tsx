import { useCallback, useMemo, useState } from "react";
import { api, errorText, type Settings } from "../lib/api";
import { useLoad } from "../lib/useAsync";
import Modal from "./Modal";
import { versionLabel } from "../lib/versions";

type Props = {
  settings: Settings;
  onPick: (id: string) => void;
  onSettings: (s: Settings) => void;
  onClose: () => void;
};

export default function VersionsModal({ settings, onPick, onSettings, onClose }: Props) {
  const load = useCallback(() => api.listVersions(), []);
  const { data, error, reload } = useLoad(load);
  const [query, setQuery] = useState("");
  const [fabricFor, setFabricFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = data?.versions ?? [];
    return all.filter(
      (v) =>
        (settings.show_snapshots || v.kind === "release" || v.kind === "modded" || v.kind === "installed" || v.installed) &&
        v.id.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [data, query, settings.show_snapshots]);

  async function addFabric(game: string) {
    setBusy(true);
    setActionError(null);
    try {
      const loaders = await api.fabricLoaders(game);
      if (loaders.length === 0) throw "Fabric для этой версии нет";
      const id = await api.addFabric(game, loaders[0]);
      onPick(id);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
      setFabricFor(null);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteVersion(id);
      reload();
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <Modal title="Версия игры" onClose={onClose} wide>
      <div className="row">
        <input className="input grow" placeholder="Поиск, например 1.20.1" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <label className="check">
          <input
            type="checkbox"
            checked={settings.show_snapshots}
            onChange={(e) => onSettings({ ...settings, show_snapshots: e.target.checked })}
          />
          Снапшоты и старые
        </label>
      </div>
      {data && !data.online && <p className="muted">Нет связи с Mojang, показаны только установленные версии.</p>}
      {(error || actionError) && <p className="error-text">{error ?? actionError}</p>}

      <ul className="version-list">
        {!data && !error && <li className="muted">Загрузка…</li>}
        {list.map((v) => (
          <li key={v.id} className={v.id === settings.last_version ? "selected" : ""}>
            <button className="version-pick" onClick={() => onPick(v.id)}>
              <b>{versionLabel(v.id)}</b>
              <small>
                {v.kind === "release" ? "Релиз" : v.kind === "snapshot" ? "Снапшот" : v.kind === "modded" ? "С модами" : v.kind}
                {data?.latest === v.id && " · новейшая"}
                {v.installed && " · установлена"}
              </small>
            </button>
            {v.kind === "release" && (
              <button className="btn small" disabled={busy} onClick={() => (setFabricFor(v.id), addFabric(v.id))}>
                {fabricFor === v.id ? "…" : "+ Fabric"}
              </button>
            )}
            {v.installed && (
              <button className="icon-btn small" title="Удалить" onClick={() => remove(v.id)}>✕</button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
