import { getCurrentWindow } from "@tauri-apps/api/window";

/** Custom title bar for the frameless window. */
export default function TitleBar() {
  const win = getCurrentWindow();
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-name" data-tauri-drag-region>
        <img src="/logo.svg" alt="" width={18} height={18} />
        BI4VISUAL LAUNCHER
      </div>
      <div className="titlebar-buttons">
        <button onClick={() => win.minimize()} aria-label="Свернуть">─</button>
        <button onClick={() => win.toggleMaximize()} aria-label="Развернуть">☐</button>
        <button className="close" onClick={() => win.close()} aria-label="Закрыть">✕</button>
      </div>
    </div>
  );
}
