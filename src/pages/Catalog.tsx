import { useEffect, useRef, useState } from "react";
import { api, errorText, formatCount, type Hit, type ModFile, type PackFile, type Sort, type Source } from "../lib/api";
import { useT, type Key } from "../lib/i18n";
import type { Shared } from "../App";
import * as I from "../components/Icons";

type Props = Shared & { kind: "mod" | "resourcepack" };

const SORTS: { id: Sort; key: Key }[] = [
  { id: "downloads", key: "cat.popular" },
  { id: "relevance", key: "cat.relevant" },
  { id: "updated", key: "cat.updated" },
  { id: "newest", key: "cat.newest" },
];

/** Mods or resource packs from Modrinth and CurseForge for the selected build. */
export default function Catalog(s: Props) {
  const { t, lang } = useT();
  const mods = s.kind === "mod";
  const instance = s.instances.instances.find((i) => i.id === s.instances.selected) ?? null;
  const [source, setSource] = useState<Source>("modrinth");
  const [view, setView] = useState<"catalog" | "installed">("catalog");
  const [sort, setSort] = useState<Sort>("downloads");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [installedMods, setInstalledMods] = useState<ModFile[]>([]);
  const [installedPacks, setInstalledPacks] = useState<PackFile[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const req = useRef(0);

  const reloadInstalled = () => {
    if (!instance) return;
    if (mods) api.mods(instance.id).then(setInstalledMods, () => setInstalledMods([]));
    else api.packs(instance.id).then(setInstalledPacks, () => setInstalledPacks([]));
  };
  useEffect(reloadInstalled, [instance?.id, mods]);

  useEffect(() => {
    if (view !== "catalog") return;
    const id = ++req.current;
    setHits(null);
    setError(null);
    const timer = setTimeout(() => {
      api.search(source, query, s.kind, instance?.id ?? null, sort).then(
        (r) => {
          if (id !== req.current) return;
          setHits(r.hits);
          setTotal(r.total_hits);
        },
        (e) => id === req.current && setError(errorText(e)),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [query, source, sort, view, instance?.id, s.kind]);

  async function more() {
    const r = await api.search(source, query, s.kind, instance?.id ?? null, sort, hits?.length ?? 0);
    setHits((h) => [...(h ?? []), ...r.hits]);
  }

  async function install(h: Hit) {
    if (!instance) return;
    setWorking(h.project_id);
    setError(null);
    setDone(null);
    try {
      const added = await api.install(s.kind, instance.id, h.project_id);
      setDone(t("cat.done", { list: added.join(", ") }));
      reloadInstalled();
      s.setInstances(await api.instances());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(null);
    }
  }

  const installedIds = new Set((instance?.mods ?? []).map((m) => m.project_id));
  const ver = instance ? instance.game_version : "—";
  const srcName = source === "modrinth" ? "Modrinth" : "CurseForge";
  const needLoader = mods && instance?.loader === "vanilla";

  return (
    <div className="page-pad catalog">
      <div className="page-head">
        <div>
          <h1>{t(mods ? "nav.mods" : "nav.packs")}</h1>
          <p className="sub">{t(mods ? "cat.modsSub" : "cat.packsSub", { src: srcName, ver: instance ? `Minecraft ${ver}` : "—" })}</p>
        </div>
        <div className="row">
          <label className="search head-search">
            <I.Search size={18} />
            <input
              placeholder={t(mods ? "cat.searchMods" : "cat.searchPacks")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setView("catalog");
              }}
            />
          </label>
          <div className="seg">
            <button className={view === "catalog" ? "active" : ""} onClick={() => setView("catalog")}>{t("cat.catalog")}</button>
            <button className={view === "installed" ? "active" : ""} onClick={() => setView("installed")}>{t("cat.installed")}</button>
          </div>
        </div>
      </div>

      {!instance ? (
        <div className="empty-center">
          <p>{t("cat.needBuild")}</p>
          <button className="btn primary" onClick={() => s.go("builds")}>{t("nav.builds")}</button>
        </div>
      ) : view === "installed" ? (
        <div className="list scroll">
          {mods
            ? installedMods.map((m) => (
                <div key={m.file_name} className="card item-row">
                  {m.icon_url ? <img src={m.icon_url} alt="" className="item-icon" /> : <span className="item-icon empty"><I.Puzzle /></span>}
                  <span className="grow item-text">
                    <b>{m.title}</b>
                    <small>{m.file_name}</small>
                  </span>
                  <Toggle on={m.enabled} onChange={async (v) => { await api.toggleMod(instance.id, m.file_name, v); reloadInstalled(); }} />
                  <Remove id={m.file_name} confirm={confirm} setConfirm={setConfirm} onRemove={async () => { await api.removeMod(instance.id, m.file_name); reloadInstalled(); s.setInstances(await api.instances()); }} />
                </div>
              ))
            : installedPacks.map((p) => (
                <div key={p.file_name} className="card item-row">
                  <span className="item-icon empty"><I.Image /></span>
                  <span className="grow item-text"><b>{p.file_name.replace(/\.zip$/i, "")}</b></span>
                  <Toggle on={p.enabled} onChange={async (v) => { await api.togglePack(instance.id, p.file_name, v); reloadInstalled(); }} />
                  <Remove id={p.file_name} confirm={confirm} setConfirm={setConfirm} onRemove={async () => { await api.removePack(instance.id, p.file_name); reloadInstalled(); }} />
                </div>
              ))}
          {(mods ? installedMods : installedPacks).length === 0 && <p className="empty-text">{t("cat.noInstalled")}</p>}
          <button className="btn" onClick={() => api.openInstanceDir(instance.id)}><I.Folder size={16} /> {t("common.folder")}</button>
        </div>
      ) : (
        <>
          <div className="row between toolbar">
            <div className="pills">
              {SORTS.map((x) => (
                <button key={x.id} className={sort === x.id ? "active" : ""} onClick={() => setSort(x.id)}>{t(x.key)}</button>
              ))}
            </div>
            <div className="row">
              {hits && <small>{t(mods ? "cat.totalMods" : "cat.totalPacks", { n: total.toLocaleString(lang), ver })}</small>}
              <div className="seg small">
                <button className={source === "modrinth" ? "active" : ""} onClick={() => setSource("modrinth")}>Modrinth</button>
                <button className={source === "curseforge" ? "active" : ""} onClick={() => setSource("curseforge")}>CurseForge</button>
              </div>
            </div>
          </div>
          {needLoader && <div className="note">{t("cat.vanilla")}</div>}
          {error && (
            <div className="note err">
              {error}
              {source === "curseforge" && error.includes("API") && <button className="link" onClick={() => s.go("settings")}>{t("nav.settings")}</button>}
            </div>
          )}
          {done && <div className="note ok">{done}</div>}
          <div className="hit-grid scroll">
            {!hits && !error && <p className="empty-text">{t("common.loading")}</p>}
            {hits?.length === 0 && <p className="empty-text">{t("common.nothing")}</p>}
            {hits?.map((h) => {
              const has = installedIds.has(h.project_id);
              return (
                <div key={h.project_id} className="card hit">
                  {h.icon_url ? <img src={h.icon_url} alt="" className="hit-icon" loading="lazy" /> : <span className="hit-icon empty" />}
                  <div className="hit-text">
                    <b>{h.title}</b>
                    <small className="hit-meta">
                      {[h.author, t("cat.downloads", { n: formatCount(h.downloads, lang) }), ...h.categories.slice(0, 3)].filter(Boolean).join(" · ")}
                    </small>
                    <p>{h.description}</p>
                  </div>
                  <button className="btn" disabled={has || working !== null || needLoader} onClick={() => install(h)}>
                    {working === h.project_id ? t("common.installing") : has ? t("common.installed") : t("common.install")}
                  </button>
                </div>
              );
            })}
            {hits && hits.length < total && (
              <div className="more-row">
                <button className="btn wide" onClick={more}>{t("common.more")}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle${on ? " on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Remove({ id, confirm, setConfirm, onRemove }: { id: string; confirm: string | null; setConfirm: (v: string | null) => void; onRemove: () => void }) {
  const { t } = useT();
  return confirm === id ? (
    <button className="btn small danger" onClick={() => { setConfirm(null); onRemove(); }}>{t("common.sure")}</button>
  ) : (
    <button className="btn icon" title={t("common.remove")} onClick={() => setConfirm(id)}><I.Trash size={16} /></button>
  );
}
