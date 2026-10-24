import { useEffect, useRef, useState } from "react";
import { api, errorText, type Account, type Accounts, type Skin } from "../lib/api";
import { COSMETICS, toggleCosmetic, type CosmeticId } from "../lib/cosmetics";
import { EMOTES, type EmoteKind } from "../lib/livelyAnimation";
import Page from "./Page";
import SkinViewer from "./SkinViewer";
import SkinFront from "./SkinFront";

type Props = {
  account: Account | null;
  skin: Skin | null;
  cosmetics: string[];
  onCosmetics: (c: string[]) => void;
  onChanged: (a?: Accounts) => void;
  onAccounts: () => void;
  onClose: () => void;
};

const TABS = [
  { id: "skin", name: "Скины", icon: "🧍" },
  { id: "head", name: "Голова", icon: "👑" },
  { id: "back", name: "Спина", icon: "🪽" },
  { id: "cape", name: "Плащи", icon: "🧣" },
  { id: "emotes", name: "Эмоции", icon: "😀" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const RARITY: Record<CosmeticId, { name: string; color: string }> = {
  halo: { name: "Редкая", color: "#3b82f6" },
  horns: { name: "Эпическая", color: "#a855f7" },
  crown: { name: "Мифическая", color: "#ef4444" },
  wings_angel: { name: "Эпическая", color: "#a855f7" },
  wings_demon: { name: "Мифическая", color: "#ef4444" },
  cape: { name: "Особая", color: "#22c55e" },
};

export default function SkinPage({ account, skin, cosmetics, onCosmetics, onChanged, onAccounts, onClose }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [tab, setTab] = useState<Tab>("skin");
  const [preview, setPreview] = useState<{ url: string; bytes: number[] } | null>(null);
  const [slim, setSlim] = useState(skin?.slim ?? false);
  const [emote, setEmote] = useState<{ kind: EmoteKind; n: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const licensed = account?.kind === "microsoft";

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setStatus(null);
    setPreview({ url: URL.createObjectURL(f), bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
    setTab("skin");
    if (file.current) file.current.value = "";
  }

  async function save() {
    if (!account || !preview) return;
    setSaving(true);
    setError(null);
    try {
      const accounts = await api.uploadSkin(account.id, preview.bytes, slim);
      setStatus(licensed ? "Скин сохранён в аккаунте Microsoft, его увидят все." : "Скин сохранён, в игре появится при следующем запуске.");
      setPreview(null);
      onChanged(accounts);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function resetSkin() {
    if (!account) return;
    onChanged(await api.resetSkin(account.id));
    setPreview(null);
    setStatus("Вернули стандартный скин.");
  }

  const worn = COSMETICS.filter((c) => cosmetics.includes(c.id));
  const items = tab === "head" || tab === "back" || tab === "cape" ? COSMETICS.filter((c) => c.slot === tab) : [];

  return (
    <Page
      onBack={onClose}
      actions={
        account && (
          <button className="accent-btn" onClick={() => file.current?.click()}>
            ⤒ Загрузить скин
          </button>
        )
      }
    >
      <input ref={file} type="file" accept="image/png" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="skin-page">
        <div className="skin-left">
          <div className="skin-stage" ref={stage}>
            <SkinViewer
              skin={preview?.url ?? skin?.data_url ?? null}
              slim={preview ? slim : skin?.slim ?? false}
              width={size.w}
              height={size.h}
              cosmetics={cosmetics}
              emote={emote}
            />
          </div>
          <div className="set-bar">
            <div className="row between">
              <span>
                <b>Сет</b> <small>{worn.length ? `${worn.length} ${worn.length === 1 ? "вещь" : worn.length < 5 ? "вещи" : "вещей"}` : "пусто"}</small>
              </span>
              {worn.length > 0 && (
                <button className="link-btn" onClick={() => onCosmetics([])}>Сбросить</button>
              )}
            </div>
            <div className="set-items">
              {worn.map((c) => (
                <button key={c.id} className="set-item" title={`Снять: ${c.name}`} onClick={() => onCosmetics(toggleCosmetic(cosmetics, c.id))}>
                  {c.icon}
                </button>
              ))}
            </div>
            {preview && (
              <button className="accent-btn wide" disabled={saving} onClick={save}>
                {saving ? "Сохраняю…" : "Сохранить скин"}
              </button>
            )}
          </div>
        </div>

        <div className="skin-right">
          <nav className="cat-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                <span>{t.icon}</span>
                {t.name}
              </button>
            ))}
          </nav>

          {tab === "skin" && (
            <div className="skin-tab">
              {!account ? (
                <div className="empty-card">
                  <p>Сначала добавь аккаунт.</p>
                  <button className="accent-btn" onClick={onAccounts}>Аккаунты</button>
                </div>
              ) : (
                <>
                  <div className="item-grid">
                    <div className="item-card current">
                      <div className="item-art"><SkinFront className="item-skin" skin={skin?.data_url ?? null} slim={skin?.slim ?? false} /></div>
                      <b>Мой скин</b>
                      <small>{account.custom_skin || licensed ? "Свой" : "Стандартный"}</small>
                    </div>
                    {preview && (
                      <div className="item-card active">
                        <div className="item-art"><SkinFront className="item-skin" skin={preview.url} slim={slim} /></div>
                        <b>Новый</b>
                        <small>Не сохранён</small>
                      </div>
                    )}
                    <button className="item-card add" onClick={() => file.current?.click()}>
                      <div className="item-art">＋</div>
                      <b>Загрузить</b>
                      <small>PNG 64×64</small>
                    </button>
                  </div>
                  <div className="set-card">
                    <div className="set-row">
                      <div className="set-label"><b>Модель</b><small>Толщина рук</small></div>
                      <div className="choice">
                        <button className={!slim ? "active" : ""} onClick={() => setSlim(false)}>Классическая</button>
                        <button className={slim ? "active" : ""} onClick={() => setSlim(true)}>Тонкие руки</button>
                      </div>
                    </div>
                    {!licensed && account.custom_skin && (
                      <div className="set-row">
                        <div className="set-label"><b>Стандартный скин</b></div>
                        <button className="ghost-btn" onClick={resetSkin}>Вернуть</button>
                      </div>
                    )}
                  </div>
                  {!licensed && (
                    <small className="muted">
                      Без лицензии свой скин в игре видишь только ты. Чтобы его видели все, нужен лицензионный аккаунт или скин-система на сервере.
                    </small>
                  )}
                </>
              )}
            </div>
          )}

          {items.length > 0 && (
            <div className="item-grid">
              {items.map((c) => {
                const on = cosmetics.includes(c.id);
                const r = RARITY[c.id];
                return (
                  <button
                    key={c.id}
                    className={on ? "item-card active" : "item-card"}
                    style={{ ["--rarity" as string]: r.color }}
                    onClick={() => onCosmetics(toggleCosmetic(cosmetics, c.id))}
                  >
                    <span className="rarity">{r.name}</span>
                    <div className="item-art">{c.icon}</div>
                    <b>{c.name}</b>
                    <small>{on ? "Надето" : "Надеть"}</small>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "emotes" && (
            <div className="item-grid">
              {EMOTES.map((e) => (
                <button key={e.kind} className="item-card" style={{ ["--rarity" as string]: "#f59e0b" }} onClick={() => setEmote((cur) => ({ kind: e.kind, n: (cur?.n ?? 0) + 1 }))}>
                  <div className="item-art">{e.icon}</div>
                  <b>{e.name}</b>
                  <small>Показать</small>
                </button>
              ))}
            </div>
          )}

          {(tab === "head" || tab === "back" || tab === "cape") && (
            <small className="muted">Косметика видна в лаунчере. В игре её пока нет.</small>
          )}
          {status && <p className="notice">{status}</p>}
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </Page>
  );
}
