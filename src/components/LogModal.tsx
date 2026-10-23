import Modal from "./Modal";

export default function LogModal({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  return (
    <Modal title="Журнал игры" onClose={onClose} wide>
      <pre className="log">{lines.join("\n") || "Пусто"}</pre>
      <div className="row end">
        <button className="btn" onClick={() => navigator.clipboard.writeText(lines.join("\n"))}>Скопировать</button>
      </div>
    </Modal>
  );
}
