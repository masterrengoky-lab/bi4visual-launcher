import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorText, type Accounts, type DeviceCode } from "../lib/api";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { useT } from "../lib/i18n";

type Props = { accounts: Accounts; onChange: (a: Accounts) => void; onClose: () => void };

export default function AccountsModal({ accounts, onChange, onClose }: Props) {
  const { t } = useT();
  const [nick, setNick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<DeviceCode | null>(null);

  async function run(p: Promise<Accounts>) {
    setError(null);
    try {
      onChange(await p);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  }

  async function addOffline(e: React.FormEvent) {
    e.preventDefault();
    if (await run(api.addOffline(nick))) setNick("");
  }

  async function microsoft() {
    setError(null);
    try {
      const c = await api.msStart();
      setCode(c);
      await navigator.clipboard.writeText(c.user_code).catch(() => {});
      openUrl(c.verification_uri);
      await run(api.msFinish());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setCode(null);
    }
  }

  return (
    <Modal title={t("acc.title")} onClose={onClose}>
      <ul className="account-list">
        {accounts.accounts.map((a) => (
          <li key={a.id} className={a.id === accounts.selected ? "selected" : ""}>
            <button className="account-pick" onClick={() => run(api.selectAccount(a.id))}>
              <Avatar uuid={a.uuid} name={a.name} />
              <span>
                <b>{a.name}</b>
                <small>{a.kind === "microsoft" ? t("acc.microsoft") : t("acc.offline")}</small>
              </span>
            </button>
            <button className="icon-btn small" title={t("common.remove")} onClick={() => run(api.removeAccount(a.id))}>×</button>
          </li>
        ))}
        {accounts.accounts.length === 0 && <li className="muted">{t("acc.none")}</li>}
      </ul>

      <form className="row" onSubmit={addOffline}>
        <input
          className="input grow"
          placeholder={t("acc.nick")}
          value={nick}
          maxLength={16}
          onChange={(e) => setNick(e.target.value)}
        />
        <button className="btn primary" disabled={nick.trim().length < 3}>{t("common.add")}</button>
      </form>

      {accounts.microsoft_available && (
        code ? (
          <div className="ms-code">
            {t("acc.msOpen", { url: code.verification_uri })}
            <div className="code">{code.user_code}</div>
            <small className="muted">{t("acc.msWait")}</small>
          </div>
        ) : (
          <button className="btn ms" onClick={microsoft}>{t("acc.ms")}</button>
        )
      )}
      {error && <p className="error-text">{error}</p>}
    </Modal>
  );
}
