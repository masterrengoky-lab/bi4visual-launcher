import { useEffect, useRef, useState } from "react";
import { api, errorText, readBytes, type SavedSkin } from "../lib/api";
import { useT } from "../lib/i18n";
import type { Shared } from "../App";
import SkinFront from "../components/SkinFront";
import * as I from "../components/Icons";

/** Well-known players whose skins people often look for. */
const POPULAR = [
  "Dream", "Technoblade", "Notch", "jeb_", "Ph1LzA", "TommyInnit", "GeorgeNotFound", "Sapnap",
  "Tubbo", "Ranboo", "CaptainSparklez", "DanTDM", "Grian", "MumboJumbo", "xisumavoid", "Skeppy",
  "BadBoyHalo", "Quackity", "KarlJacobs", "WilburSoot", "Fundy", "Purpled", "Nihachu", "Antfrost",
];

type Tab = "popular" | "nick" | "mine";

export default function Skins(s: Shared) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("popular");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSkin[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [slim, setSlim] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const account = s.accounts.accounts.find((a) => a.id === s.accounts.selected) ?? null;

  useEffect(() => {
    api.savedSkins().then(setSaved, () => setSaved([]));
  }, []);

  async function run(id: string, f: () => Promise<unknown>, ok: string) {
    setBusy(id);
    setNote(null);
    try {
      await f();
      setNote({ ok: true, text: ok });
    } catch (e) {
      setNote({ ok: false, text: errorText(e) });
    } finally {
      setBusy(null);
    }
  }

  function wear(name: string) {
    if (!account) return s.openAccounts();
    run(`wear:${name}`, async () => {
      s.setAccounts(await api.applySkinOf(account.id, name));
      s.reloadSkin();
    }, `${t("skins.applied")}: ${name}`);
  }

  function keep(name: string) {
    run(`save:${name}`, async () => setSaved(await api.saveSkinOf(name)), `${t("skins.saved")}: ${name}`);
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    await run("upload", async () => {
      setSaved(await api.saveSkin(f.name.replace(/\.png$/i, ""), await readBytes(f), slim));
      setTab("mine");
    }, t("skins.saved"));
    if (file.current) file.current.value = "";
  }

  const names = tab === "popular" ? POPULAR : found ? [found] : [];

  return (
    <div className="page-pad skins">
      <div className="page-head">
        <div>
          <h1>{t("skins.title")}</h1>
          <p className="sub">{t("skins.sub")}</p>
        </div>
        <form
          className="search head-search"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length >= 3) {
              setFound(query.trim());
              setTab("nick");
            }
          }}
        >
          <I.Search size={18} />
          <input placeholder={t("skins.searchNick")} value={query} maxLength={16} onChange={(e) => setQuery(e.target.value)} />
        </form>
      </div>

      <div className="row between toolbar">
        <div className="pills">
          <button className={tab === "popular" ? "active" : ""} onClick={() => setTab("popular")}>{t("skins.popular")}</button>
          <button className={tab === "nick" ? "active" : ""} onClick={() => setTab("nick")}>{t("skins.byNick")}</button>
          <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>{t("skins.mine")}</button>
        </div>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={slim} onChange={(e) => setSlim(e.target.checked)} />
            {t("skins.slim")}
          </label>
          <button className="btn" disabled={busy !== null} onClick={() => file.current?.click()}>
            <I.Upload size={16} /> {t("skins.upload")}
          </button>
          <input ref={file} type="file" accept="image/png" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>

      {note && <div className={`note ${note.ok ? "ok" : "err"}`}>{note.text}</div>}
      {!account && <div className="note">{t("skins.noAccount")}</div>}

      <div className="skin-grid scroll">
        {tab !== "mine" &&
          names.map((name) => (
            <div key={name} className="card skin-card">
              <div className="skin-img">
                <img src={`https://mc-heads.net/body/${encodeURIComponent(name)}/120`} alt="" loading="lazy" />
              </div>
              <span className="skin-name">{name}</span>
              <div className="skin-actions">
                <button className="btn grow" disabled={busy !== null} onClick={() => wear(name)}>
                  {busy === `wear:${name}` ? t("common.installing") : t("skins.apply")}
                </button>
                <button className="btn icon" title={t("skins.save")} disabled={busy !== null} onClick={() => keep(name)}>
                  <I.Save size={16} />
                </button>
              </div>
            </div>
          ))}
        {tab === "nick" && !found && <p className="empty-text">{t("skins.source")}</p>}
        {tab === "mine" && saved?.length === 0 && <p className="empty-text">{t("skins.emptyMine")}</p>}
        {tab === "mine" &&
          saved?.map((sk) => (
            <div key={sk.id} className="card skin-card">
              <div className="skin-img">
                <SkinFront skin={sk.data_url} slim={sk.slim} />
              </div>
              <span className="skin-name">{sk.name}</span>
              <div className="skin-actions">
                <button
                  className="btn grow"
                  disabled={busy !== null}
                  onClick={() => {
                    if (!account) return s.openAccounts();
                    run(`wear:${sk.id}`, async () => {
                      s.setAccounts(await api.applySavedSkin(account.id, sk.id));
                      s.reloadSkin();
                    }, `${t("skins.applied")}: ${sk.name}`);
                  }}
                >
                  {busy === `wear:${sk.id}` ? t("common.installing") : t("skins.apply")}
                </button>
                <button className="btn icon" title={t("common.remove")} onClick={async () => setSaved(await api.removeSavedSkin(sk.id))}>
                  <I.Trash size={16} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
