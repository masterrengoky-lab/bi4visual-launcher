import { useState } from "react";

/** Player head from mc-heads.net; falls back to the first letter when offline. */
export default function Avatar({ uuid, name }: { uuid: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="avatar fallback">{name.slice(0, 1).toUpperCase()}</span>;
  }
  return <img className="avatar" src={`https://mc-heads.net/avatar/${uuid}/64`} alt="" onError={() => setFailed(true)} />;
}
