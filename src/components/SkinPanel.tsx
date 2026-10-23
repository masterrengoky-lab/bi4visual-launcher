import { useRef, useState } from "react";
import { api, errorText, type Account, type Accounts, type Skin } from "../lib/api";
import Modal from "./Modal";
import SkinViewer from "./SkinViewer";

type Props = {
  account: Account | null;
  skin: Skin | null;
  onChanged: (a?: Accounts) => void;
  onAccounts: () => void;
  onClose: () => void;
};

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
    if (file.current) file.current.value = "";
  }

  async function save() {
    if (!account || !preview) return;
    setSaving(true);
    setError(null);
    try {
      const accounts = await api.uploadSkin(account.id, preview.bytes, slim);
      setStatus(
        licensed
          ? "Скин сохранён в аккаунте Microsoft. Его увидят все игроки."
          : "Скин сохранён. В игре он появится при следующем запуске.",
      );
      setPreview(null);
      onChanged(accounts);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!account) return;
    onChanged(await api.resetSkin(account.id));
    setStatus("Вернули стандартный скин.");
  }

  const licensed = account?.kind === "microsoft";

  return (
    <Modal title="Мой скин" onClose={onClose} wide>
      <div className="skin-panel">
        <div className="skin-preview">
          <SkinViewer
            skin={preview?.url ?? skin?.data_url ?? null}
            slim={preview ? slim : skin?.slim ?? false}
            width={280}
            height={380}
          />
        </div>
        <div className="skin-side">
          {!account ? (
            <>
              <p>Сначала добавьте аккаунт.</p>
              <button className="btn primary" onClick={onAccounts}>Аккаунты</button>
            </>
          ) : (
            <>
              <p>
                Выберите PNG-файл скина 64×64. Скины можно найти на сайтах вроде namemc.com или minecraftskins.com, либо нарисовать
                самому.
              </p>
              <input ref={file} type="file" accept="image/png" hidden onChange={(e) => pick(e.target.files?.[0])} />
              <div className="row">
                <button className="btn" onClick={() => file.current?.click()}>Выбрать файл…</button>
                {!licensed && account.custom_skin && (
                  <button className="btn" onClick={reset}>Вернуть стандартный</button>
                )}
              </div>
              <div className="field">
                <span>Модель</span>
                <div className="segmented">
                  <button className={!slim ? "active" : ""} onClick={() => setSlim(false)}>Классическая</button>
                  <button className={slim ? "active" : ""} onClick={() => setSlim(true)}>Тонкие руки</button>
                </div>
              </div>
              <button className="mc-btn yellow" disabled={!preview || saving} onClick={save}>
                {saving ? "Сохраняю…" : "Сохранить скин"}
              </button>
              {!licensed && (
                <small>
                  Без лицензии свой скин в игре видите только вы, а другие игроки со стандартным скином у вас тоже будут выглядеть так.
                  Чтобы скин видели все, нужен лицензионный аккаунт или скин-система на сервере.
                </small>
              )}
            </>
          )}
          {status && <p className="notice">{status}</p>}
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
