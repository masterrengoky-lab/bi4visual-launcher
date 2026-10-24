import { useEffect, type ReactNode } from "react";

/** A full-window page over the lobby, with a back button in the corner and actions on the right. */
export default function Page({ onBack, actions, children }: { onBack: () => void; actions?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onBack();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);
  return (
    <div className="page">
      <div className="page-bar">
        <button className="back-btn" onClick={onBack}>‹ Лобби</button>
        <div className="page-actions">{actions}</div>
      </div>
      <div className="page-body">{children}</div>
    </div>
  );
}
