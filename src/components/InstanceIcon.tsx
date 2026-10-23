import type { Instance, Loader } from "../lib/api";

const COLORS: Record<Loader, string> = {
  vanilla: "linear-gradient(135deg, #4ade80, #15803d)",
  fabric: "linear-gradient(135deg, #e7d9b0, #a08a5a)",
  quilt: "linear-gradient(135deg, #c084fc, #7e22ce)",
  forge: "linear-gradient(135deg, #fb923c, #9a3412)",
  neoforge: "linear-gradient(135deg, #fdba74, #c2410c)",
};

/** Modpack icon when there is one, otherwise a coloured block with the version. */
export default function InstanceIcon({ instance, size }: { instance: Instance | null; size: number }) {
  if (instance?.icon_url) {
    return <img className="instance-icon" src={instance.icon_url} alt="" width={size} height={size} />;
  }
  return (
    <span className="instance-icon block" style={{ width: size, height: size, background: COLORS[instance?.loader ?? "vanilla"] }}>
      {instance ? instance.game_version.replace(/^1\./, "") : "★"}
    </span>
  );
}
