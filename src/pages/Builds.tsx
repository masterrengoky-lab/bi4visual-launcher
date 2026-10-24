import { useEffect, useMemo, useRef, useState } from "react";
import { api, errorText, formatCount, type GameVersions, type Hit, type Instances, type Loader, type ModFile } from "../lib/api";
import { formatPlaytime, useT } from "../lib/i18n";
import type { Shared } from "../App";
import Modal from "../components/Modal";
import InstanceIcon from "../components/InstanceIcon";
import { Toggle } from "./Catalog";
import * as I from "../components/Icons";

export const LOADER_LABEL: Record<Loader, string> = {
  vanilla: "Vanilla",
  fabric: "Fabric",
  quilt: "Quilt",
  forge: "Forge",
  neoforge: "NeoForge",
};
const LOADERS: Loader[] = ["fabric", "vanilla", "forge", "neoforge", "quilt"];

export default function Builds(s: Shared) {
  const { t } = useT();
  const list = s.instances.instances;
  const [open, setOpen] = useState<string | null>(s.instances.selected);
  const [creating, setCreating] = useState(list.length === 0);
  const [newName, setNewName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = list.find((i) => i.id === open) ?? null;

  async function run(p: Promise<Instances>) {
    setError(null);
    try {
      const r = await p;
      s.setInstances(r);
      return r;
    } catch (e) {
      setError(errorText(e));
      return null;
    }
  }

  return (
    <div className="page-pad builds">
      <div className="page-head">
        <div>
          <h1>{t("builds.title")}</h1>
          <p className="sub">{t("builds.sub")}</p>
        </div>
      </div>
      <div className="builds-layout">
        <div className="card builds-left">
          <small className="label">{t("builds.yours")}</small>
          <div className="build-list scroll">
            {list.map((i) => (
              <button key={i.id} className={`build-item${open === i.id && !creating ? " open" : ""}`} onClick={() => { setOpen(i.id); setCreating(false); }}>
                <InstanceIcon instance={i} size={32} />
                <span className="grow">
                  <b>{i.name}</b>
                  <small>{i.mods.length ? t("builds.modsN", { n: i.mods.length }) : t("builds.emptyMods")} · {i.game_version}</small>
                </span>
                {i.id === s.instances.selected && <span className="badge on">{t("builds.active")}</span>}
              </button>
            ))}
          </div>
          <input className="input" placeholder={t("builds.newName")} value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn" onClick={() => setCreating(true)}><I.Plus size={16} /> {t("builds.create")}</button>
          <button className="btn" onClick={() => setImporting(true)}><I.File size={16} /> {t("builds.import")}</button>
        </div>

        <div className="builds-right">
          {error && <div className="note err">{error}</div>}
          {creating ? (
            <div className="card">
              <CreateForm
                initialName={newName}
                showSnapshots={s.settings.show_snapshots}
                onSnapshots={(v) => s.saveSettings({ ...s.settings, show_snapshots: v })}
                onCancel={list.length ? () => setCreating(false) : undefined}
                onCreate={async (name, game, loader, lv) => {
                  const r = await run(api.createInstance(name, game, loader, lv));
                  if (r) {
                    setOpen(r.selected);
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
            </div>
          ) : current ? (
            <BuildEditor key={current.id} s={s} id={current.id} run={run} onDeleted={() => setOpen(null)} onOpen={setOpen} />
          ) : (
            <p className="empty-text">{t("builds.noneYet")}</p>
          )}
        </div>
      </div>
      {importing && (
        <ImportModal
          busy={s.game !== "stopped"}
          onInstalled={(r) => {
            s.setInstances(r);
            setOpen(r.selected);
            setCreating(false);
            setImporting(false);
          }}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

function BuildEditor({ s, id, run, onDeleted, onOpen }: { s: Shared; id: string; run: (p: Promise<Instances>) => Promise<Instances | null>; onDeleted: () => void; onOpen: (id: string | null) => void }) {
  const { t, lang } = useT();
  const inst = s.instances.instances.find((i) => i.id === id)!;
  const [name, setName] = useState(inst.name);
  const [mods, setMods] = useState<ModFile[]>([]);
  const [confirm, setConfirm] = useState(false);
  const busy = s.game !== "stopped";

  const reload = () => api.mods(id).then(setMods, () => setMods([]));
  useEffect(() => {
    reload();
  }, [id]);

  return (
    <>
      <div className="card build-head-wrap">
      <div className="build-head">
        <label className="field grow">
          <small className="label">{t("builds.name")}</small>
          <input className="input big" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          className="btn primary big"
          disabled={busy}
          onClick={async () => {
            if (await run(api.selectInstance(id))) s.play();
          }}
        >
          <I.Play size={18} /> {t("builds.playHere")}
        </button>
        <button className="btn icon big" title={t("common.save")} disabled={name.trim() === inst.name || !name.trim()} onClick={() => run(api.renameInstance(id, name))}>
          <I.Save size={18} />
        </button>
        <button className="btn icon big" title={t("builds.duplicate")} onClick={async () => { const r = await run(api.duplicateInstance(id)); if (r) onOpen(r.selected); }}>
          <I.Copy size={18} />
        </button>
        <button className="btn icon big" title={t("common.folder")} onClick={() => api.openInstanceDir(id)}>
          <I.Folder size={18} />
        </button>
        {confirm ? (
          <button className="btn danger big" disabled={busy} onClick={async () => { if (await run(api.deleteInstance(id))) onDeleted(); }}>{t("common.sure")}</button>
        ) : (
          <button className="btn icon big" title={t("common.remove")} disabled={busy} onClick={() => setConfirm(true)}><I.Trash size={18} /></button>
        )}
      </div>
        <div className="build-meta">
          <span>Minecraft {inst.game_version} · {LOADER_LABEL[inst.loader]}{inst.loader_version ? ` ${inst.loader_version}` : ""}</span>
          <span>{t("builds.playtime")}: {formatPlaytime(t, inst.playtime_secs)}</span>
          {inst.last_played && <span>{t("builds.lastPlayed")}: {new Date(inst.last_played * 1000).toLocaleDateString(lang)}</span>}
        </div>
      </div>
      <div className="mod-grid scroll">
        {mods.map((m) => (
          <div key={m.file_name} className="card mod-tile">
            {m.icon_url ? <img src={m.icon_url} alt="" className="item-icon" /> : <span className="item-icon empty"><I.Puzzle /></span>}
            <span className="grow item-text">
              <b>{m.title}</b>
              <small>{m.file_name}</small>
            </span>
            <Toggle on={m.enabled} onChange={async (v) => { await api.toggleMod(id, m.file_name, v); reload(); }} />
          </div>
        ))}
        {mods.length === 0 && (
          <p className="empty-text">
            {t("builds.noMods")} <button className="link" onClick={() => s.go("mods")}>{t("nav.mods")}</button>
          </p>
        )}
      </div>
    </>
  );
}

function CreateForm({
  initialName,
  showSnapshots,
  onSnapshots,
  onCancel,
  onCreate,
}: {
  initialName: string;
  showSnapshots: boolean;
  onSnapshots: (v: boolean) => void;
  onCancel?: () => void;
  onCreate: (name: string, game: string, loader: Loader, loaderVersion: string | null) => void;
}) {
  const { t } = useT();
  const [versions, setVersions] = useState<GameVersions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [game, setGame] = useState("");
  const [loader, setLoader] = useState<Loader>("fabric");
  const [loaderVersions, setLoaderVersions] = useState<string[] | null>(null);
  const [loaderVersion, setLoaderVersion] = useState("");
  const [name, setName] = useState(initialName);
  const [nameTouched, setNameTouched] = useState(initialName.trim() !== "");

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
    if (!nameTouched && game) setName(`${LOADER_LABEL[loader]} ${game}`);
  }, [game, loader, nameTouched]);

  const list = useMemo(() => (versions?.versions ?? []).filter((v) => showSnapshots || v.kind === "release"), [versions, showSnapshots]);
  const noLoader = loader !== "vanilla" && loaderVersions !== null && loaderVersions.length === 0;

  return (
    <div className="create-form">
      <h2>{t("builds.create")}</h2>
      {loadError && <div className="note err">{t("builds.versionsError", { e: loadError })}</div>}
      <div className="field">
        <small className="label">{t("builds.loader")}</small>
        <div className="seg">
          {LOADERS.map((l) => (
            <button key={l} className={l === loader ? "active" : ""} onClick={() => setLoader(l)}>{LOADER_LABEL[l]}</button>
          ))}
        </div>
      </div>
      <div className="row">
        <label className="field grow">
          <small className="label">{t("builds.version")}</small>
          <select className="input" value={game} onChange={(e) => setGame(e.target.value)} disabled={!versions}>
            {!versions && <option>{t("common.loading")}</option>}
            {list.map((v) => (
              <option key={v.id} value={v.id}>{v.id}{v.kind !== "release" ? ` (${v.kind})` : ""}</option>
            ))}
          </select>
        </label>
        {loader !== "vanilla" && (
          <label className="field grow">
            <small className="label">{t("builds.loaderVersion", { loader: LOADER_LABEL[loader] })}</small>
            <select className="input" value={loaderVersion} onChange={(e) => setLoaderVersion(e.target.value)} disabled={!loaderVersions?.length}>
              <option value="">{loaderVersions === null ? t("common.loading") : noLoader ? t("builds.noLoader") : t("builds.recommended")}</option>
              {loaderVersions?.slice(0, 60).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={showSnapshots} onChange={(e) => onSnapshots(e.target.checked)} />
        {t("builds.snapshots")}
      </label>
      <label className="field">
        <small className="label">{t("builds.name")}</small>
        <input className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} />
      </label>
      <div className="row end">
        {onCancel && <button className="btn" onClick={onCancel}>{t("common.cancel")}</button>}
        <button className="btn primary" disabled={!game || !name.trim() || noLoader} onClick={() => onCreate(name, game, loader, loaderVersion || null)}>
          <I.Plus size={16} /> {t("builds.create")}
        </button>
      </div>
    </div>
  );
}

function ImportModal({ busy, onInstalled, onClose }: { busy: boolean; onInstalled: (i: Instances) => void; onClose: () => void }) {
  const { t, lang } = useT();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    const timer = setTimeout(() => {
      api.search("modrinth", query, "modpack", null, query ? "relevance" : "downloads").then(
        (r) => id === req.current && setHits(r.hits),
        (e) => id === req.current && setError(errorText(e)),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal title={t("builds.importTitle")} onClose={onClose} large>
      <label className="search">
        <I.Search size={18} />
        <input autoFocus placeholder={t("builds.searchPacks")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <div className="note err">{error}</div>}
      <div className="list">
        {!hits && !error && <p className="empty-text">{t("common.loading")}</p>}
        {hits?.map((h) => (
          <div key={h.project_id} className="card hit">
            {h.icon_url ? <img src={h.icon_url} alt="" className="hit-icon" /> : <span className="hit-icon empty" />}
            <div className="hit-text">
              <b>{h.title}</b>
              <small className="hit-meta">{h.author} · {t("cat.downloads", { n: formatCount(h.downloads, lang) })}</small>
              <p>{h.description}</p>
            </div>
            <button
              className="btn primary"
              disabled={busy || working !== null}
              onClick={async () => {
                setWorking(h.project_id);
                setError(null);
                try {
                  onInstalled(await api.installPack(h.project_id));
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setWorking(null);
                }
              }}
            >
              {working === h.project_id ? t("common.installing") : t("common.install")}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
