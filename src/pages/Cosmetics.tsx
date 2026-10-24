import { useEffect, useRef, useState } from "react";
import { COSMETICS, preview, toggleCosmetic, type Category } from "../lib/cosmetics";
import { useT, type Key } from "../lib/i18n";
import type { Shared } from "../App";
import SkinViewer from "../components/SkinViewer";
import Scene from "../components/Scene";
import * as I from "../components/Icons";

const TABS: { id: Category; key: Key }[] = [
  { id: "cape", key: "cos.capes" },
  { id: "wings", key: "cos.wings" },
  { id: "hat", key: "cos.hats" },
];

export default function Cosmetics(s: Shared) {
  const { t, lang } = useT();
  const worn = s.settings.cosmetics.filter((id) => COSMETICS.some((c) => c.id === id));
  const [tab, setTab] = useState<Category>("cape");
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [picked, setPicked] = useState<string | null>(worn[0] ?? null);
  const account = s.accounts.accounts.find((a) => a.id === s.accounts.selected);

  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 420 });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const save = (list: string[]) => s.saveSettings({ ...s.settings, cosmetics: list });
  const items = COSMETICS.filter(
    (c) =>
      c.category === tab &&
      (!onlyMine || worn.includes(c.id)) &&
      (!query || c.name[lang].toLowerCase().includes(query.toLowerCase())),
  );
  const current = COSMETICS.find((c) => c.id === picked);

  return (
    <div className="page-pad cosmetics">
      <div className="page-head">
        <div>
          <h1 className="big">{t("cos.title")}</h1>
          <p className="sub">{t("cos.sub")}</p>
        </div>
      </div>
      <div className="cos-layout">
        <div className="cos-left">
          <div className="card cos-stage" ref={stage}>
            <Scene image={s.background} dim={s.settings.bg_dim} blur={s.settings.bg_blur} particles={false} />
            <div className="cos-stage-top">
              <b>{account?.name ?? "Steve"}</b>
              <span className="badge">{t("cos.equippedN", { n: worn.length })}</span>
            </div>
            <SkinViewer skin={s.skin?.data_url ?? null} slim={s.skin?.slim ?? false} width={size.w} height={size.h} cosmetics={worn} />
            <div className="cos-hint"><I.Rotate size={16} /> {t("cos.drag")}</div>
          </div>
          <div className="card worn">
            <div className="row between">
              <b>{t("cos.equipped")}</b>
              {worn.length > 0 && <button className="link" onClick={() => save([])}>{t("cos.unequipAll")}</button>}
            </div>
            <div className="worn-list">
              {worn.length === 0 && <small>{t("cos.nothingOn")}</small>}
              {worn.map((id) => {
                const c = COSMETICS.find((x) => x.id === id)!;
                return (
                  <div key={id} className="worn-item">
                    <span className="thumb">
                      <img src={preview(id)} alt="" />
                      <button className="thumb-x" onClick={() => save(worn.filter((w) => w !== id))} aria-label={t("cos.unequip")}><I.X size={12} /></button>
                    </span>
                    <span>
                      <b>{c.name[lang]}</b>
                      <small>{t(TABS.find((x) => x.id === c.category)!.key)}</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card cos-right">
          <label className="search">
            <I.Search size={18} />
            <input placeholder={t("cos.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="tabs">
            {TABS.map((x) => (
              <button key={x.id} className={tab === x.id ? "active" : ""} onClick={() => setTab(x.id)}>{t(x.key)}</button>
            ))}
          </div>
          <div className="row between">
            <label className="check">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              {t("cos.onlyMine")}
            </label>
            <small>{t("cos.count", { n: COSMETICS.filter((c) => c.category === tab).length, e: worn.length })}</small>
          </div>
          <div className="cos-grid">
            {!onlyMine && !query && (
              <button
                className={`cos-card${!worn.some((w) => COSMETICS.find((c) => c.id === w)?.category === tab) ? " on" : ""}`}
                onClick={() => save(worn.filter((w) => COSMETICS.find((c) => c.id === w)?.category !== tab))}
              >
                <span className="cos-none"><I.X size={22} /></span>
                <b>{t("cos.none")}</b>
              </button>
            )}
            {items.map((c) => (
              <button
                key={c.id}
                className={`cos-card${worn.includes(c.id) ? " on" : ""}${picked === c.id ? " picked" : ""}`}
                onClick={() => setPicked(c.id)}
                onDoubleClick={() => save(toggleCosmetic(worn, c.id))}
              >
                {worn.includes(c.id) && <span className="badge on"><I.Check size={12} /> {t("cos.equipped")}</span>}
                <img src={preview(c.id)} alt="" className={c.category === "cape" ? "cape" : "icon"} />
                <b>{c.name[lang]}</b>
              </button>
            ))}
          </div>
          {current && (
            <div className="cos-selected">
              <span className="thumb big"><img src={preview(current.id)} alt="" /></span>
              <span className="grow">
                <b>{current.name[lang]}</b>
                <small>{t(TABS.find((x) => x.id === current.category)!.key)}</small>
              </span>
              <button className={`btn big ${worn.includes(current.id) ? "" : "primary"}`} onClick={() => save(toggleCosmetic(worn, current.id))}>
                {worn.includes(current.id) ? <><I.X size={18} /> {t("cos.unequip")}</> : <><I.Check size={18} /> {t("cos.equip")}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
