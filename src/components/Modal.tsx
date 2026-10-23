import { useEffect, type ReactNode } from "react";

export default function Modal({ title, onClose, children, wide, large }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; large?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}${large ? " large" : ""}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
