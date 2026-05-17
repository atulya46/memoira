// Handdrawn SVG decoration components

export function WavyUnderline({ color = "#8b5e3c", width = 180 }: { color?: string; width?: number }) {
  const points = Array.from({ length: Math.ceil(width / 10) + 1 }, (_, i) => {
    const x = i * 10;
    const y = i % 2 === 0 ? 1 : 7;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={10} viewBox={`0 0 ${width} 10`} fill="none" style={{ display: "block", marginTop: 2, marginBottom: 4 }}>
      <polyline points={points} stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
    </svg>
  );
}

export function InkDots({ color = "#8b5e3c" }: { color?: string }) {
  return (
    <svg width="44" height="8" viewBox="0 0 44 8" fill="none">
      {([4, 11, 22, 33, 40] as number[]).map((cx, i) => (
        <circle key={i} cx={cx} cy="4" r={i === 2 ? 2.5 : 1.5} fill={color} opacity={i === 2 ? 0.5 : 0.28} />
      ))}
    </svg>
  );
}

type StickerDef = { viewBox: string; children: React.ReactNode };

const STICKERS: StickerDef[] = [
  // 0 Sun
  { viewBox: "0 0 32 32", children: (
    <>
      <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      {([0,45,90,135,180,225,270,315] as number[]).map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return <line key={i} x1={16 + 8.5 * Math.cos(a)} y1={16 + 8.5 * Math.sin(a)} x2={16 + 12 * Math.cos(a)} y2={16 + 12 * Math.sin(a)} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />;
      })}
    </>
  )},
  // 1 Camera
  { viewBox: "0 0 32 32", children: (
    <>
      <rect x="4" y="9" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="16" cy="17" r="5" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="16" cy="17" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M10 9 L12 5 L20 5 L22 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </>
  )},
  // 2 Compass
  { viewBox: "0 0 32 32", children: (
    <>
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <polygon points="16,6 18,16 16,26 14,16" fill="currentColor" opacity="0.7" />
      <circle cx="16" cy="16" r="2" fill="currentColor" />
    </>
  )},
  // 3 Plane
  { viewBox: "0 0 32 32", children: (
    <path d="M28 4 L4 16 L12 17 L14 28 L18 22 L24 24 L28 4Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
  )},
  // 4 Leaf
  { viewBox: "0 0 32 32", children: (
    <>
      <path d="M16 28 C16 28 6 22 6 12 C6 6 12 4 16 4 C20 4 26 6 26 12 C26 22 16 28 16 28Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <line x1="16" y1="28" x2="16" y2="10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </>
  )},
  // 5 Star
  { viewBox: "0 0 32 32", children: (
    <polygon points="16,3 19.5,12 29,12 21.5,18 24,27 16,22 8,27 10.5,18 3,12 12.5,12" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
  )},
  // 6 Map pin
  { viewBox: "0 0 32 32", children: (
    <>
      <path d="M16 4 C11 4 7 8 7 13 C7 20 16 28 16 28 C16 28 25 20 25 13 C25 8 21 4 16 4Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="16" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </>
  )},
  // 7 Heart
  { viewBox: "0 0 32 32", children: (
    <path d="M16 27 C16 27 4 19 4 11 C4 7 7 4 11 4 C13 4 15 5 16 7 C17 5 19 4 21 4 C25 4 28 7 28 11 C28 19 16 27 16 27Z" stroke="currentColor" strokeWidth="1.4" fill="none" />
  )},
];

const ROTATIONS = [-12, 8, -6, 10, -8, 6, -10, 12];

export function DaySticker({ dayIndex, color = "#8b5e3c" }: { dayIndex: number; color?: string }) {
  const s = STICKERS[dayIndex % STICKERS.length];
  const rot = ROTATIONS[dayIndex % ROTATIONS.length];
  return (
    <svg viewBox={s.viewBox} width="36" height="36" fill="none"
      style={{ color, transform: `rotate(${rot}deg)`, opacity: 0.65 }}>
      {s.children}
    </svg>
  );
}

export function StarAccent({ color = "#8b5e3c" }: { color?: string }) {
  return (
    <span style={{ color, opacity: 0.32, fontSize: "10px", letterSpacing: "6px", userSelect: "none" }}>
      ✦ ✦ ✦
    </span>
  );
}

// ─── New icons ────────────────────────────────────────────────────────────────

/** Sparkle cluster — replaces ✨ in Highlights heading */
export function SparkleIcon({ color = "#8b5e3c", size = 26 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ display: "inline-block", verticalAlign: "middle", opacity: 0.8 }}>
      {/* Big 4-point star */}
      <path d="M14 2 L15.4 10.6 L24 12 L15.4 13.4 L14 22 L12.6 13.4 L4 12 L12.6 10.6 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round"
        fill={color} fillOpacity="0.15" />
      {/* Small star top-right */}
      <path d="M21 3 L21.7 5.8 L24.5 6.5 L21.7 7.2 L21 10 L20.3 7.2 L17.5 6.5 L20.3 5.8 Z"
        stroke={color} strokeWidth="1" strokeLinejoin="round"
        fill={color} fillOpacity="0.25" />
      {/* Tiny dot bottom-left */}
      <circle cx="5.5" cy="20" r="1.5" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

/** Map pin — for location links */
export function MapPinDoodle({ color = "#8b5e3c", size = 15 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 16 20" fill="none"
      style={{ display: "inline-block", verticalAlign: "middle", opacity: 0.7 }}>
      <path d="M8 1.5 C4.5 1.5 1.5 4.4 1.5 8 C1.5 13.5 8 18.5 8 18.5 C8 18.5 14.5 13.5 14.5 8 C14.5 4.4 11.5 1.5 8 1.5Z"
        stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.12" />
      <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.2" fill="none" />
    </svg>
  );
}

/** Doodle pen — for the doodles toggle button */
export function PenDoodle({ color = "#8b5e3c", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 17 L5 12 L14.5 2.5 L17.5 5.5 L8 15 Z"
        stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12" strokeLinejoin="round" />
      <path d="M14.5 2.5 L17.5 5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 17 L5.5 14.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="3" y1="17" x2="6" y2="17" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Camera doodle — for photo upload tile */
export function CameraDoodle({ color = "#9a8070", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
      <rect x="2" y="6" width="20" height="14" rx="2.5" stroke={color} strokeWidth="1.4" fill="none" />
      <circle cx="12" cy="13" r="3.5" stroke={color} strokeWidth="1.3" fill="none" />
      <circle cx="12" cy="13" r="1.3" fill={color} opacity="0.35" />
      <path d="M8 6 L9.5 3 L14.5 3 L16 6" stroke={color} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <circle cx="18.5" cy="9" r="1" fill={color} opacity="0.45" />
    </svg>
  );
}

/** Mic doodle — for voice note upload tile */
export function MicDoodle({ color = "#9a8070", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
      <rect x="8" y="2" width="8" height="11" rx="4" stroke={color} strokeWidth="1.4" fill="none" />
      <path d="M4 11 C4 15.4 7.6 18.5 12 18.5 C16.4 18.5 20 15.4 20 11"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9" y1="21.5" x2="15" y2="21.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* small pulse lines */}
      <line x1="10" y1="6.5" x2="14" y2="6.5" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />
      <line x1="10" y1="9" x2="14" y2="9" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/** Pen-on-paper doodle — for write note upload tile */
export function NotePenDoodle({ color = "#9a8070", size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
      <path d="M4 4 L16.5 4 L20 7.5 L20 20 L4 20 Z"
        stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <path d="M16.5 4 L16.5 7.5 L20 7.5" stroke={color} strokeWidth="1.4" fill="none" />
      <line x1="7" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
      <line x1="7" y1="13" x2="15" y2="13" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
      <line x1="7" y1="16" x2="12" y2="16" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
      {/* pen nib in corner */}
      <path d="M16 17 L19 14 L21 16 L18 19 Z"
        stroke={color} strokeWidth="1.1" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

/** Open book — for Scrapbook HubCard */
export function BookDoodle({ color = "#9a8070", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ opacity: 0.85 }}>
      <path d="M2 5 C2 5 6 4 12 4 C18 4 22 5 22 5 L22 20 C22 20 18 19 12 19 C6 19 2 20 2 20 Z"
        stroke={color} strokeWidth="1.4" fill="none" strokeLinejoin="round" />
      <line x1="12" y1="4" x2="12" y2="19" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="5" y1="8" x2="11" y2="7.5" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      <line x1="5" y1="11" x2="11" y2="10.5" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      <line x1="13" y1="7.5" x2="19" y2="8" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      <line x1="13" y1="10.5" x2="19" y2="11" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Small leaf — decorative accent for home page */
export function LeafAccent({ color = "#7a8e6a", size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ opacity: 0.55, display: "inline-block" }}>
      <path d="M10 18 C10 18 3 13 3 7 C3 3 7 2 10 2 C13 2 17 3 17 7 C17 13 10 18 10 18Z"
        stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.12" />
      <line x1="10" y1="18" x2="10" y2="7" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

/** Doodled wave greeting — hand-drawn sinusoidal wave */
export function WaveGreeting({ color = "#6a7e5a", size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={Math.round(size * 2.2)} height={size} viewBox="0 0 44 18" fill="none"
      style={{ display: "inline-block", verticalAlign: "middle", opacity: 0.7 }}>
      <path d="M2 10 C7 3 12 3 17 10 C22 17 27 17 32 10 C37 3 40 4 42 8"
        stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

/** Doodled journal illustration — for empty photo placeholder on journal cards */
export function JournalDoodle({ color = "#8b7a60", size = 52 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" style={{ opacity: 0.4 }}>
      {/* Book body */}
      <rect x="8" y="6" width="36" height="40" rx="3" stroke={color} strokeWidth="1.4" fill="none"/>
      {/* Spine */}
      <line x1="16" y1="6" x2="16" y2="46" stroke={color} strokeWidth="1.4" opacity="0.6"/>
      {/* Lines */}
      <line x1="20" y1="16" x2="38" y2="16" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
      <line x1="20" y1="21" x2="38" y2="21" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
      <line x1="20" y1="26" x2="32" y2="26" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
      {/* Small star doodle */}
      <path d="M26 33 L27.2 36.6 L31 36.6 L28 38.6 L29.2 42.2 L26 40.2 L22.8 42.2 L24 38.6 L21 36.6 L24.8 36.6 Z" stroke={color} strokeWidth="1" fill="none" strokeLinejoin="round" opacity="0.6"/>
      {/* Small corner fold */}
      <path d="M36 6 L44 6 L44 14 L36 6 Z" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" strokeLinejoin="round"/>
    </svg>
  );
}
