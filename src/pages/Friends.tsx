import { useEffect, useState } from "react";
import { api, errorText, type Friend } from "../lib/api";
import { useT } from "../lib/i18n";
import type { Shared } from "../App";
import * as I from "../components/Icons";

export default function Friends(s: Shared) {
  const { t, lang } = useT();
  const [list, setList] = useState<Friend[] | null>(null);
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const account = s.accounts.accounts.find((a) => a.id === s.accounts.selected) ?? null;

  const reload = () => api.friends().then(setList, () => setList([]));
  useEffect(() => {
    reload();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setList(await api.addFriend(nick));
      setNick("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function takeSkin(name: string) {
    if (!account) return s.openAccounts();
    setError(null);
    try {
      s.setAccounts(await api.applySkinOf(account.id, name));
      s.reloadSkin();
      setNote(`${t("skins.applied")}: ${name}`);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="page-pad friends">
      <div className="page-head">
        <div>
          <h1>{t("friends.title")}</h1>
          <p className="sub">{t("friends.count", { n: list?.length ?? 0 })}</p>
        </div>
        <form className="row" onSubmit={add}>
          <label className="search head-search">
            <I.User size={18} />
            <input placeholder={t("friends.placeholder")} value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy || nick.trim().length < 3}>{t("common.add")}</button>
          <button type="button" className="btn icon" onClick={reload} aria-label="refresh"><I.Refresh size={18} /></button>
        </form>
      </div>
      {error && <div className="note err">{error}</div>}
      {note && <div className="note ok">{note}</div>}
      <div className="friends-layout">
        <div className="friend-list scroll">
          {list?.length === 0 && <div className="empty-center"><p>{t("friends.empty")}</p></div>}
          {list?.map((f) => (
            <div key={f.name} className="card friend">
              <Head friend={f} />
              <span className="grow item-text">
                <b>{f.name}</b>
                <small>
                  {f.uuid ? t("friends.licensed") : t("friends.offline")} · {t("friends.since", { date: new Date(f.added * 1000).toLocaleDateString(lang) })}
                </small>
              </span>
              <button className="btn icon" title={t("friends.copy")} onClick={() => navigator.clipboard.writeText(f.name)}><I.Copy size={16} /></button>
              {f.uuid && <button className="btn small" onClick={() => takeSkin(f.name)}>{t("friends.takeSkin")}</button>}
              <button className="btn icon" title={t("common.remove")} onClick={async () => setList(await api.removeFriend(f.name))}><I.Trash size={16} /></button>
            </div>
          ))}
        </div>
        <div className="card friends-side">
          <b>{t("friends.howTitle")}</b>
          <p>{t("friends.how")}</p>
        </div>
      </div>
    </div>
  );
}

function Head({ friend }: { friend: Friend }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="friend-head fallback">{friend.name.slice(0, 1).toUpperCase()}</span>;
  return <img className="friend-head" src={`https://mc-heads.net/avatar/${friend.uuid ?? encodeURIComponent(friend.name)}/64`} alt="" onError={() => setFailed(true)} />;
}
