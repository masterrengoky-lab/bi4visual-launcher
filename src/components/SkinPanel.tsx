import { useRef, useState } from "react";
import { api, errorText, type Account, type Skin } from "../lib/api";
import Modal from "./Modal";
import SkinViewer from "./SkinViewer";

type Props = { account: Account | null; skin: Skin | null; onChanged: () => void; onAccounts: () => void; onClose: () => void };

export default function SkinPanel({ account, skin, onChanged, onAccounts, onClose }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; bytes: number[] } | null>(null);
  const [slim, setSlim] = useState(skin?.slim ?? false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setStatus(null);
    const buf = new Uint8Array(await f.arrayBuffer());
    setPreview({ url: URL.createObjectURL(f), bytes: Array.from(buf) });
  }

  async function save() {
    if (!account || !preview) return;
    setSaving(true);
    setError(null);
    try {
      await api.uploadSkin(account.id, preview.bytes, slim);
      setStatus("Скин сохранён. В игре он появится при следующем входе.");
      setPreview(null);
      onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const licensed = account?.kind === "microsoft";

  return (
    <Modal title="Скин" onClose={onClose} wide>
      <div className="skin-panel">
        <div className="skin-preview">
          <SkinViewer skin={preview?.url ?? skin?.data_url ?? null} slim={preview ? slim : skin?.slim ?? false} width={260} height={340} walking />
        </div>
        <div className="skin-side">
          {!account && (
            <>
              <p>Сначала добавьте аккаунт.</p>
              <button className="btn primary" onClick={onAccounts}>Аккаунты</button>
            </>
          )}
          {account && !licensed && (
            <p>
              У аккаунта без пароля в игре стандартный скин Стива или Алекс. Поставить свой скин можно на лицензионном аккаунте Microsoft:
              он будет виден всем игрокам на любых серверах.
            </p>
          )}
          {licensed && (
            <>
              <p>Выберите PNG-файл скина 64×64. Его можно скачать на сайтах со скинами или нарисовать самому.</p>
              <input ref={file} type="file" accept="image/png" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <button className="btn" onClick={() => file.current?.click()}>Выбрать файл…</button>
              <div className="field">
                <span>Модель</span>
                <div className="segmented">
                  <button className={!slim ? "active" : ""} onClick={() => setSlim(false)}>Классическая</button>
                  <button className={slim ? "active" : ""} onClick={() => setSlim(true)}>Тонкие руки</button>
                </div>
              </div>
              <button className="btn primary" disabled={!preview || saving} onClick={save}>
                {saving ? "Сохраняю…" : "Сохранить скин"}
              </button>
            </>
          )}
          {status && <p className="notice">{status}</p>}
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
