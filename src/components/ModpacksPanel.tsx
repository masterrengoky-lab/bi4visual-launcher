import { api, type Instances } from "../lib/api";
import Modal from "./Modal";
import HitList from "./HitList";

type Props = { busy: boolean; onInstalled: (i: Instances) => void; onClose: () => void };

export default function ModpacksPanel({ busy, onInstalled, onClose }: Props) {
  return (
    <Modal title="Модпаки" onClose={onClose} large>
      <p className="muted">Модпак ставится как новая сборка со всеми модами и настройками. Прогресс видно под кнопкой «Играть».</p>
      <HitList
        kind="modpack"
        instance={null}
        actionLabel="Установить"
        disabled={busy}
        onAction={async (hit) => onInstalled(await api.installPack(hit.project_id))}
      />
    </Modal>
  );
}
