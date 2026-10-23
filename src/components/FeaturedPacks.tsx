import { useEffect, useState } from "react";
import { api, errorText, formatCount, type Hit, type Instances } from "../lib/api";

/** Right-side card: popular Modrinth modpacks, rotating every few seconds. */
export default function FeaturedPacks({ busy, onInstalled }: { busy: boolean; onInstalled: (i: Instances) => void }) {
  const [packs, setPacks] = useState<Hit[]>([]);
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.search("", "modpack", null).then((r) => setPacks(r.hits.slice(0, 6)), () => {});
  }, []);

  useEffect(() => {
    if (hover || packs.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % packs.length), 6000);
    return () => clearInterval(t);
  }, [hover, packs.length]);

  if (packs.length === 0) return null;
  const p = packs[index];

  async function install() {
    setWorking(true);
    setError(null);
    try {
      onInstalled(await api.installPack(p.project_id));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <aside className="promo" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <small className="promo-kicker">Популярный модпак · ⬇ {formatCount(p.downloads)}</small>
      <div className="promo-body" key={p.project_id}>
        {p.icon_url && <img src={p.icon_url} alt="" className="promo-icon" />}
        <div>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
        </div>
      </div>
      <button className="mc-btn yellow" disabled={busy || working} onClick={install}>
        {working ? "Ставлю…" : "⬇ Установить"}
      </button>
      {error && <p className="error-text small">{error}</p>}
      <div className="dots">
        {packs.map((x, i) => (
          <button key={x.project_id} className={i === index ? "active" : ""} onClick={() => setIndex(i)} aria-label={x.title} />
        ))}
      </div>
    </aside>
  );
}
