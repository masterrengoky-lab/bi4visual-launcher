import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorText, readAsDataUrl, type Account, type Settings } from "../lib/api";
import { ACCENTS, BG_PRESETS } from "../lib/theme";
import type { Music } from "../lib/useMusic";
import Page from "./Page";

type Props = {
  settings: Settings;
  background: string | null;
  account: Account | null;
  music: Music;
  log: string[];
  onBackground: (url: string | null) => void;
  onSave: (s: Settings) => void;
  onAccounts: () => void;
  onClose: () => void;
};

const TABS = [
  { id: "look", name: "Вид" },
  { id: "sound", name: "Звук" },
  { id: "game", name: "Игра" },
  { id: "account", name: "Аккаунт" },
  { id: "launcher", name: "Лаунчер" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const MEMORY_STEPS = [2048, 3072, 4096, 6144, 8192, 12288, 16384];
const REPO = "https://github.com/masterrengoky-lab/bi4visual-launcher";

/** The search text; rows that don't match it hide themselves. */
const Query = createContext("");

export default function SettingsPage(props: Props) {
  const { settings: s, onSave } = props;
  const [tab, setTab] = useState<Tab>("look");
  const [query, setQuery] = useState("");
  const patch = (p: Partial<Settings>) => onSave({ ...s, ...p });
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => patch({ [k]: v } as Partial<Settings>);
  const searching = query.trim().length > 0;

  const tabs: Record<Tab, ReactNode> = {
    look: <LookTab {...props} set={set} patch={patch} />,
    sound: <SoundTab {...props} set={set} patch={patch} />,
    game: <GameTab {...props} set={set} patch={patch} />,
    account: <AccountTab {...props} />,
    launcher: <LauncherTab {...props} />,
  };

  return (
    <Page onBack={props.onClose}>
      <div className="settings-page">
        <div className="settings-head">
          <h1>Настройки</h1>
          <label className="search">
            <span aria-hidden>⌕</span>
            <input placeholder="Найти" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        {!searching && (
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
                {t.name}
              </button>
            ))}
          </nav>
        )}
        <Query.Provider value={query.trim().toLowerCase()}>
          <div className="settings-body" key={searching ? "search" : tab}>
            {searching ? TABS.map((t) => <div key={t.id}>{tabs[t.id]}</div>) : tabs[tab]}
          </div>
        </Query.Provider>
      </div>
    </Page>
  );
}

type TabProps = Props & {
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  patch: (p: Partial<Settings>) => void;
};

function LookTab({ settings: s, background, onBackground, set }: TabProps) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setBusy(true);
    try {
      onBackground(await api.setBackground(await readAsDataUrl(f)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  async function preset(id: string) {
    if (background) {
      await api.clearBackground();
      onBackground(null);
    }
    set("bg_preset", id);
  }

  return (
    <>
      <Section title="Цвет кнопок">
        <Block label="Цвет кнопок цвет акцент">
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={s.accent === c ? "swatch active" : "swatch"}
                style={{ background: c }}
                onClick={() => set("accent", c)}
                aria-label={c}
              />
            ))}
            <label className="swatch custom" title="Свой цвет">
              +
              <input type="color" value={s.accent} onChange={(e) => set("accent", e.target.value)} />
            </label>
          </div>
        </Block>
      </Section>

      <Section title="Фон">
        <Block label="Фон картинка обои">
          <div className="bg-grid">
            {BG_PRESETS.map((p) => (
              <button
                key={p.id}
                className={!background && s.bg_preset === p.id ? "bg-card active" : "bg-card"}
                style={{ background: p.css }}
                onClick={() => preset(p.id)}
              >
                <span>{p.name}</span>
              </button>
            ))}
            {background && (
              <button className="bg-card active" style={{ backgroundImage: `url("${background}")` }}>
                <span>Свой фон</span>
              </button>
            )}
            <button className="bg-card upload" disabled={busy} onClick={() => file.current?.click()}>
              <b>⤒</b>
              <span>{busy ? "Загружаю…" : "Свой фон"}</span>
            </button>
          </div>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
          {error && <p className="error-text">{error}</p>}
        </Block>
        <Row label="Затемнение фона">
          <Range value={s.bg_dim} min={0} max={90} suffix="%" onChange={(v) => set("bg_dim", v)} />
        </Row>
        <Row label="Размытие фона">
          <Range value={s.bg_blur} min={0} max={20} suffix=" px" onChange={(v) => set("bg_blur", v)} />
        </Row>
        <Row label="Летающие искры">
          <Toggle value={s.particles} onChange={(v) => set("particles", v)} />
        </Row>
      </Section>

      <Section title="Доступность">
        <Row label="Размер интерфейса">
          <Choice value={String(s.ui_scale)} options={[["100", "100%"], ["115", "115%"], ["130", "130%"], ["150", "150%"]]} onChange={(v) => set("ui_scale", Number(v))} />
        </Row>
      </Section>
    </>
  );
}

function SoundTab({ settings: s, music, set, patch }: TabProps) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) music.setTracks(await api.musicAdd(f.name, await readAsDataUrl(f)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <>
      <Section title="Музыка">
        <Row label="Музыка сейчас">
          <Toggle
            value={s.music && music.playing}
            onChange={(v) => {
              if (v) {
                if (!s.music) set("music", true);
                music.play(true);
              } else music.pause();
            }}
          />
        </Row>
        <Row label="Музыка при запуске" hint="Начинает играть, когда открываешь лаунчер">
          <Toggle value={s.music_autoplay} onChange={(v) => patch({ music_autoplay: v, music: v || s.music })} />
        </Row>
        <Row label="Плеер" hint={music.current ? trackName(music.current) : "Ничего не играет"}>
          <div className="player">
            <button className="ghost-btn" onClick={() => music.next(-1)} aria-label="Назад">‹</button>
            <button className="ghost-btn" onClick={() => music.next(1)} aria-label="Дальше">›</button>
            <Range value={s.music_volume} min={0} max={100} suffix="%" onChange={(v) => set("music_volume", v)} />
          </div>
        </Row>
        <Row label="Своя музыка" hint={`mp3, ogg, wav, m4a или flac до 100 МБ — будут играть по кругу · ${countTracks(music.tracks.length)}`}>
          <div className="row">
            <button className="accent-btn" disabled={busy} onClick={() => file.current?.click()}>
              {busy ? "Загружаю…" : "+ Добавить треки"}
            </button>
            <button className="ghost-btn" title="Папка с музыкой" onClick={() => api.musicOpenDir()}>📁</button>
          </div>
          <input ref={file} type="file" multiple accept=".mp3,.ogg,.oga,.wav,.m4a,.aac,.flac,.opus,audio/*" hidden onChange={(e) => add(e.target.files)} />
        </Row>
        {music.tracks.length > 0 && (
          <Block label="Своя музыка треки">
            <ul className="track-list">
              {music.tracks.map((t) => (
                <li key={t} className={t === music.current ? "active" : ""}>
                  <button className="track-name" onClick={() => (s.music ? music.playTrack(t) : patch({ music: true }))}>
                    {t === music.current && music.playing ? "♪ " : "▸ "}
                    {trackName(t)}
                  </button>
                  <button className="ghost-btn small" aria-label="Убрать" onClick={async () => music.setTracks(await api.musicRemove(t))}>✕</button>
                </li>
              ))}
            </ul>
          </Block>
        )}
        {(error || music.error) && <p className="error-text">{error ?? music.error}</p>}
      </Section>

      <Section title="Звуки">
        <Row label="Звуки кнопок" hint="Тихий щелчок при нажатии">
          <Toggle value={s.ui_sounds} onChange={(v) => set("ui_sounds", v)} />
        </Row>
      </Section>
    </>
  );
}

function GameTab({ settings: s, set }: TabProps) {
  const num = (v: string) => (v.trim() === "" ? null : Math.max(1, Number(v) || 0));
  const i = MEMORY_STEPS.findIndex((m) => m >= s.memory_mb);
  const memIndex = i === -1 ? MEMORY_STEPS.length - 1 : i;
  return (
    <>
      <Section title="Игра" note="Визуалы bi4visual настраиваются прямо в игре: нажми правый Shift">
        <Row label="Память для игры" hint="Больше 6 ГБ нужно только большим модпакам">
          <div className="range">
            <input type="range" min={0} max={MEMORY_STEPS.length - 1} value={memIndex} onChange={(e) => set("memory_mb", MEMORY_STEPS[Number(e.target.value)])} />
            <b>{(s.memory_mb / 1024).toFixed(s.memory_mb % 1024 ? 1 : 0)} ГБ</b>
          </div>
        </Row>
        <Row label="Размер окна" hint="Пусто — по умолчанию">
          <div className="row">
            <input className="input mini" placeholder="Ширина" value={s.width ?? ""} onChange={(e) => set("width", num(e.target.value))} />
            <input className="input mini" placeholder="Высота" value={s.height ?? ""} onChange={(e) => set("height", num(e.target.value))} />
          </div>
        </Row>
        <Row label="Полный экран">
          <Toggle value={s.fullscreen} onChange={(v) => set("fullscreen", v)} />
        </Row>
      </Section>

      <Section title="Моды" note="Ставятся сами с Modrinth при запуске, если есть версия под твою сборку">
        <Row label="Hold My Items" hint="Живые анимации рук и предметов">
          <Toggle value={s.hold_my_items} onChange={(v) => set("hold_my_items", v)} />
        </Row>
        <Row label="Simple Voice Chat" hint="Голосовой чат на серверах, где он есть">
          <Toggle value={s.voice_chat} onChange={(v) => set("voice_chat", v)} />
        </Row>
      </Section>

      <CosmeticsSection />

      <Section title="Во время игры">
        <Row label="Лаунчер при запуске игры">
          <Choice value={s.on_launch} options={[["keep", "Оставить"], ["minimize", "Свернуть"], ["hide", "Скрыть"]]} onChange={(v) => set("on_launch", v as Settings["on_launch"])} />
        </Row>
        <Row label="Вернуть лаунчер после игры">
          <Toggle value={s.restore_after_game || s.on_launch === "hide"} disabled={s.on_launch === "hide"} onChange={(v) => set("restore_after_game", v)} />
        </Row>
      </Section>

      <Section title="Для опытных">
        <Row label="Своя Java" hint="Путь к java или javaw.exe; пусто — скачается сама">
          <input className="input wide" value={s.java_path ?? ""} onChange={(e) => set("java_path", e.target.value || null)} />
        </Row>
        <Row label="Аргументы JVM">
          <input className="input wide" value={s.extra_jvm_args} onChange={(e) => set("extra_jvm_args", e.target.value)} />
        </Row>
      </Section>
    </>
  );
}

function AccountTab({ account, onAccounts }: Props) {
  return (
    <Section title="Аккаунт">
      <Row label={account ? account.name : "Нет аккаунта"} hint={account ? (account.kind === "microsoft" ? "Лицензия Microsoft" : "Офлайн-ник") : "Добавь ник или войди через Microsoft"}>
        <button className="ghost-btn" onClick={onAccounts}>Аккаунты</button>
      </Row>
    </Section>
  );
}

function LauncherTab({ settings, log }: Props) {
  const [version, setVersion] = useState("");
  const [autostart, setAutostart] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getVersion().then(setVersion, () => {});
    api.autostartGet().then(setAutostart, () => {});
  }, []);

  async function toggleAutostart(v: boolean) {
    setError(null);
    try {
      await api.autostartSet(v);
      setAutostart(v);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function copyReport() {
    const report = [
      `bi4visual launcher ${version}`,
      navigator.userAgent,
      `Настройки: ${JSON.stringify({ ...settings, java_path: settings.java_path ? "свой" : null })}`,
      "Журнал игры (последние строки):",
      ...log.slice(-200),
    ].join("\n");
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="app-card">
        <img src="/logo.svg" alt="" width={44} height={44} />
        <div className="grow">
          <b>bi4visual launcher</b>
          <small>Версия {version}</small>
        </div>
        <button className="ghost-btn" onClick={() => openUrl(`${REPO}/actions`)}>⟳ Новые версии</button>
      </div>
      <Section>
        <Row label="Исходный код на GitHub" hint={`v${version}`}>
          <button className="ghost-btn" onClick={() => openUrl(REPO)}>Открыть</button>
        </Row>
        <Row label="Новости Minecraft">
          <button className="ghost-btn" onClick={() => openUrl("https://www.minecraft.net/ru-ru/articles")}>Открыть</button>
        </Row>
        <Row label="Запускать вместе с системой">
          <Toggle value={autostart} onChange={toggleAutostart} />
        </Row>
        <Row label="Папка лаунчера" hint="Версии, Java, сборки и настройки">
          <button className="ghost-btn" onClick={() => api.openLauncherDir()}>Открыть</button>
        </Row>
        <Row label="Отчёт для поддержки" hint="Версия, настройки и журнал игры, без паролей">
          <button className="ghost-btn" onClick={copyReport}>{copied ? "Скопировано" : "Копировать"}</button>
        </Row>
        {error && <p className="error-text">{error}</p>}
      </Section>
    </>
  );
}

// ---------- building blocks ----------

function matches(query: string, ...texts: (string | undefined)[]) {
  return !query || texts.some((t) => t?.toLowerCase().includes(query));
}

/** Sword cosmetics from the player's own pack: drop a zip into the folder, import, pick in game. */
function CosmeticsSection() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    api.cosmeticsCount().then(setCount).catch(() => setCount(0));
  }, []);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = await api.cosmeticsImport();
      setCount(n);
      setMsg(`Готово: ${n} шт. Выбирай в игре: правый Shift → Cosmetics`);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Косметика" note="Положи zip с моделями мечей в папку косметики и нажми «Импортировать». Файлы остаются только у тебя">
      <Row label="Папка косметики" hint={count ? `Импортировано: ${count}` : "Пока ничего не импортировано"}>
        <div className="row">
          <button className="ghost-btn" onClick={() => api.cosmeticsOpenDir()}>Открыть</button>
          <button className="ghost-btn" disabled={busy} onClick={run}>{busy ? "Импорт…" : "Импортировать"}</button>
          {!!count && (
            <button className="ghost-btn" onClick={async () => { await api.cosmeticsClear(); setCount(0); setMsg(null); }}>Убрать</button>
          )}
        </div>
      </Row>
      {msg && <p className="hint-text">{msg}</p>}
    </Section>
  );
}

function Section({ title, note, children }: { title?: string; note?: string; children: ReactNode }) {
  const query = useContext(Query);
  return (
    <section className="set-section">
      {title && !query && <h4>{title}</h4>}
      {note && !query && <p className="set-note">{note}</p>}
      <div className="set-card">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const query = useContext(Query);
  if (!matches(query, label, hint)) return null;
  return (
    <div className="set-row">
      <div className="set-label">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

/** A wide row without a label on the left; `label` is only for the search. */
function Block({ label, children }: { label: string; children: ReactNode }) {
  const query = useContext(Query);
  if (!matches(query, label)) return null;
  return <div className="set-block">{children}</div>;
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button className={value ? "toggle on" : "toggle"} role="switch" aria-checked={value} disabled={disabled} onClick={() => onChange(!value)}>
      <span />
    </button>
  );
}

function Choice({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="choice">
      {options.map(([v, name]) => (
        <button key={v} className={value === v ? "active" : ""} onClick={() => onChange(v)}>
          {name}
        </button>
      ))}
    </div>
  );
}

function Range({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return (
    <div className="range">
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>
        {value}
        {suffix}
      </b>
    </div>
  );
}

function trackName(file: string) {
  return file.replace(/\.[^.]+$/, "");
}

function countTracks(n: number) {
  const m10 = n % 10, m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? "трек" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "трека" : "треков";
  return `${n} ${word}`;
}
