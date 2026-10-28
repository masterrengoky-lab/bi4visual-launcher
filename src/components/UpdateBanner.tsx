import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Auto-update: on start the launcher asks GitHub for a newer version and, if
 * there is one, offers it in a strip on top. One click downloads, installs and
 * restarts. Errors (offline, no release yet) are silent.
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [percent, setPercent] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    check()
      .then((u) => setUpdate(u))
      .catch(() => {});
  }, []);

  if (!update || hidden) return null;

  const install = async () => {
    setState("loading");
    let total = 0;
    let done = 0;
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        if (e.event === "Progress") {
          done += e.data.chunkLength;
          if (total > 0) setPercent(Math.round((done / total) * 100));
        }
      });
      await relaunch();
    } catch {
      setState("error");
    }
  };

  return (
    <div className="update-banner">
      <span>
        {state === "error"
          ? "Не получилось обновиться. Попробуй ещё раз."
          : state === "loading"
            ? `Скачиваю версию ${update.version}${percent !== null ? `: ${percent}%` : "…"}`
            : `Вышла новая версия ${update.version}`}
      </span>
      {state !== "loading" && (
        <>
          <button className="btn primary" onClick={install}>
            Обновить
          </button>
          <button className="btn" onClick={() => setHidden(true)}>
            Позже
          </button>
        </>
      )}
    </div>
  );
}
