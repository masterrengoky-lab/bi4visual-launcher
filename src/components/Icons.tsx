/** Line icons in one style (24×24, stroke = currentColor). */
import type { ReactNode } from "react";

function Svg({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

type P = { size?: number };

export const Home = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></Svg>;
export const Palette = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" />
    <circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="14.5" cy="7" r="1" />
  </Svg>
);
export const User = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></Svg>;
export const Puzzle = (p: P) => (
  <Svg {...p}>
    <path d="M10 4a2 2 0 1 1 4 0v1h4a1 1 0 0 1 1 1v4h-1a2 2 0 1 0 0 4h1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 1 0-4 0v1H6a1 1 0 0 1-1-1v-4h1a2 2 0 1 0 0-4H5V6a1 1 0 0 1 1-1h4z" />
  </Svg>
);
export const Image = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-9 9" /></Svg>;
export const Layers = (p: P) => <Svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></Svg>;
export const Users = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c.8-3 3-4.5 6-4.5s5.2 1.5 6 4.5" /><path d="M15.5 14.6c2.6-.3 4.6 1 5.5 3.9" /></Svg>;
export const Gear = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
export const Search = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Svg>;
export const Play = (p: P) => <Svg {...p}><path d="M7 4.5v15l12.5-7.5z" fill="currentColor" /></Svg>;
export const Chevron = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const Globe = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></Svg>;
export const Save = (p: P) => <Svg {...p}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4" /><rect x="8" y="13" width="8" height="5" /></Svg>;
export const Copy = (p: P) => <Svg {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>;
export const Trash = (p: P) => <Svg {...p}><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></Svg>;
export const Refresh = (p: P) => <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>;
export const Plus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const File = (p: P) => <Svg {...p}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></Svg>;
export const X = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
export const Check = (p: P) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const Folder = (p: P) => <Svg {...p}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></Svg>;
export const Rotate = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 0 1 14-5.3" /><path d="M18 3v4h-4" /><path d="M20 12a8 8 0 0 1-14 5.3" /><path d="M6 21v-4h4" /></Svg>;
export const Upload = (p: P) => <Svg {...p}><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></Svg>;
export const Bug = (p: P) => <Svg {...p}><rect x="7" y="7" width="10" height="13" rx="5" /><path d="M9 7a3 3 0 0 1 6 0M3 13h4M17 13h4M4 8l3 2M20 8l-3 2M4 19l3-2M20 19l-3-2" /></Svg>;
export const Download = (p: P) => <Svg {...p}><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></Svg>;
