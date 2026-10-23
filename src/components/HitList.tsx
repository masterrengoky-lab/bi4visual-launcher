import { useEffect, useRef, useState } from "react";
import { api, errorText, formatCount, type Hit } from "../lib/api";

type Props = {
  kind: "mod" | "modpack";
  instance: string | null;
  installed?: Set<string>;
  actionLabel: string;
  onAction: (hit: Hit) => Promise<void>;
  disabled?: boolean;
};

/** Modrinth search box with results and an install button on each. */
export default function HitList({ kind, instance, installed, actionLabel, onAction, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    const t = setTimeout(() => {
      setError(null);
      api.search(query, kind, instance).then(
        (r) => {
          if (id !== req.current) return;
          setHits(r.hits);
          setTotal(r.total_hits);
        },
        (e) => id === req.current && setError(errorText(e)),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query, kind, instance]);

  async function more() {
    const r = await api.search(query, kind, instance, hits?.length ?? 0);
    setHits((h) => [...(h ?? []), ...r.hits]);
  }

  async function act(hit: Hit) {
    setWorking(hit.project_id);
    setError(null);
    try {
      await onAction(hit);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="hits">
      <input
        className="input"
        placeholder={kind === "mod" ? "Поиск модов: sodium, jei, journeymap…" : "Поиск модпаков"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {error && <p className="error-text">{error}</p>}
      <ul className="hit-list">
        {!hits && !error && <li className="muted">Загрузка…</li>}
        {hits?.length === 0 && <li className="muted">Ничего не нашлось</li>}
        {hits?.map((h) => {
          const has = installed?.has(h.project_id);
          return (
            <li key={h.project_id} className="hit">
              {h.icon_url ? <img src={h.icon_url} alt="" className="hit-icon" /> : <span className="hit-icon empty" />}
              <div className="hit-text">
                <b>{h.title}</b> <small>от {h.author}</small>
                <p>{h.description}</p>
                <small>⬇ {formatCount(h.downloads)}</small>
              </div>
              <button className={`btn ${has ? "" : "primary"}`} disabled={disabled || has || working !== null} onClick={() => act(h)}>
                {working === h.project_id ? "Ставлю…" : has ? "Установлен" : actionLabel}
              </button>
            </li>
          );
        })}
      </ul>
      {hits && hits.length < total && (
        <button className="btn" onClick={more}>Показать ещё</button>
      )}
    </div>
  );
}
