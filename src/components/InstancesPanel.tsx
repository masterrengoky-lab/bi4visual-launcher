import { useEffect, useMemo, useState } from "react";
import { api, errorText, LOADER_NAMES, type GameVersions, type Instances, type Loader } from "../lib/api";
import Modal from "./Modal";
import InstanceIcon from "./InstanceIcon";

type Props = {
  instances: Instances;
  showSnapshots: boolean;
  onSnapshots: (v: boolean) => void;
  onChange: (i: Instances) => void;
  onClose: () => void;
};

const LOADERS: Loader[] = ["vanilla", "fabric", "forge", "neoforge", "quilt"];

export default function InstancesPanel({ instances, showSnapshots, onSnapshots, onChange, onClose }: Props) {
  const [creating, setCreating] = useState(instances.instances.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function run(p: Promise<Instances>) {
    setError(null);
    try {
      onChange(await p);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  }

  return (
    <Modal title={creating ? "Новая сборка" : "Сборки"} onClose={onClose} large>
      {creating ? (
        <CreateForm
          showSnapshots={showSnapshots}
          onSnapshots={onSnapshots}
          onCancel={instances.instances.length ? () => setCreating(false) : undefined}
          onCreate={async (name, game, loader, lv) => {
            if (await run(api.createInstance(name, game, loader, lv))) onClose();
          }}
        />
      ) : (
        <>
          <div className="instance-grid">
            {instances.instances.map((i) => (
              <div key={i.id} className={`instance-tile${i.id === instances.selected ? " selected" : ""}`}>
                <button className="instance-pick" onClick={async () => (await run(api.selectInstance(i.id))) && onClose()}>
                  <InstanceIcon instance={i} size={64} />
                  <b>{i.name}</b>
                  <small>
                    {i.game_version} · {LOADER_NAMES[i.loader]}
                  </small>
                </button>
                <div className="instance-actions">
                  <button className="btn small" onClick={() => api.openInstanceDir(i.id)}>Папка</button>
                  {confirmDelete === i.id ? (
                    <button className="btn small danger" onClick={() => run(api.deleteInstance(i.id))}>Точно удалить?</button>
                  ) : (
                    <button className="btn small" onClick={() => setConfirmDelete(i.id)}>Удалить</button>
                  )}
                </div>
              </div>
            ))}
            <button className="instance-tile add" onClick={() => setCreating(true)}>
              <span className="plus">+</span>
              <b>Создать сборку</b>
            </button>
          </div>
        </>
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}

function CreateForm({
  showSnapshots,
  onSnapshots,
  onCancel,
  onCreate,
}: {
  showSnapshots: boolean;
  onSnapshots: (v: boolean) => void;
  onCancel?: () => void;
  onCreate: (name: string, game: string, loader: Loader, loaderVersion: string | null) => void;
}) {
  const [versions, setVersions] = useState<GameVersions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [game, setGame] = useState("");
  const [loader, setLoader] = useState<Loader>("fabric");
  const [loaderVersions, setLoaderVersions] = useState<string[] | null>(null);
  const [loaderVersion, setLoaderVersion] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    api.gameVersions().then(
      (v) => {
        setVersions(v);
        setGame(v.latest);
      },
      (e) => setLoadError(errorText(e)),
    );
  }, []);

  useEffect(() => {
    setLoaderVersions(null);
    setLoaderVersion("");
    if (!game || loader === "vanilla") return setLoaderVersions([]);
    let alive = true;
    api.loaderVersions(loader, game).then(
      (v) => alive && setLoaderVersions(v),
      () => alive && setLoaderVersions([]),
    );
    return () => {
      alive = false;
    };
  }, [game, loader]);

  useEffect(() => {
    if (!nameTouched && game) setName(loader === "vanilla" ? `Minecraft ${game}` : `${LOADER_NAMES[loader]} ${game}`);
  }, [game, loader, nameTouched]);

  const list = useMemo(
    () => (versions?.versions ?? []).filter((v) => showSnapshots || v.kind === "release"),
    [versions, showSnapshots],
  );
  const noLoader = loader !== "vanilla" && loaderVersions !== null && loaderVersions.length === 0;

  return (
    <div className="create-form">
      {loadError && <p className="error-text">Не удалось загрузить список версий: {loadError}</p>}
      <div className="field">
        <span>Загрузчик модов</span>
        <div className="segmented">
          {LOADERS.map((l) => (
            <button key={l} className={l === loader ? "active" : ""} onClick={() => setLoader(l)}>
              {LOADER_NAMES[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="field grow">
          <span>Версия игры</span>
          <select className="input" value={game} onChange={(e) => setGame(e.target.value)} disabled={!versions}>
            {!versions && <option>Загрузка…</option>}
            {list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
                {v.kind !== "release" ? ` (${v.kind === "snapshot" ? "снапшот" : "старая"})` : ""}
              </option>
            ))}
          </select>
        </label>
        {loader !== "vanilla" && (
          <label className="field grow">
            <span>Версия {LOADER_NAMES[loader]}</span>
            <select className="input" value={loaderVersion} onChange={(e) => setLoaderVersion(e.target.value)} disabled={!loaderVersions?.length}>
              <option value="">{loaderVersions === null ? "Загрузка…" : noLoader ? "Нет для этой версии" : "Рекомендуемая"}</option>
              {loaderVersions?.slice(0, 60).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={showSnapshots} onChange={(e) => onSnapshots(e.target.checked)} />
        Показывать снапшоты и старые версии
      </label>
      <label className="field">
        <span>Название</span>
        <input
          className="input"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setNameTouched(true);
          }}
        />
      </label>
      <div className="row end">
        {onCancel && <button className="btn" onClick={onCancel}>Назад</button>}
        <button
          className="btn primary"
          disabled={!game || !name.trim() || noLoader}
          onClick={() => onCreate(name, game, loader, loaderVersion || null)}
        >
          Создать
        </button>
      </div>
    </div>
  );
}
