import Modal from "./Modal";
import { useT } from "../lib/i18n";

export default function LogModal({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal title={t("common.log")} onClose={onClose} wide>
      <pre className="log">{lines.join("\n") || t("common.empty")}</pre>
      <div className="row end">
        <button className="btn" onClick={() => navigator.clipboard.writeText(lines.join("\n"))}>{t("common.copy")}</button>
      </div>
    </Modal>
  );
}
