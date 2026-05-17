"use client";

const SCENE_GRADIENTS: Record<string, string> = {
  // ── Ghibli scene types ─────────────────────────────────────────────────────
  beach:        "linear-gradient(160deg, #a8d8ea 0%, #fde8a0 55%, #f5c97a 100%)",
  forest:       "linear-gradient(160deg, #52b788 0%, #b7e4c7 55%, #d8f3dc 100%)",
  mountain:     "linear-gradient(160deg, #7b6fa8 0%, #c9b8e8 55%, #ede8f5 100%)",
  city_upscale: "linear-gradient(160deg, #d8d0e8 0%, #e8dfd0 45%, #f0e8d8 100%)",
  city_small:   "linear-gradient(160deg, #f8e8c8 0%, #f0d8a8 50%, #fdf3dc 100%)",
  heritage:     "linear-gradient(160deg, #c1440e 0%, #e07b39 45%, #f5d8b0 100%)",
  countryside:  "linear-gradient(160deg, #80b946 0%, #c5e8a0 50%, #edf7dc 100%)",
  default:      "linear-gradient(160deg, #ddebd0 0%, #f0ead8 50%, #dce8f0 100%)",

  // ── Theme backgrounds ──────────────────────────────────────────────────────
  // Vintage: warm sepia-amber, similar softness to Ghibli but in golden tones
  vintage: [
    "radial-gradient(ellipse at 20% 15%, rgba(255,240,185,0.9) 0%, transparent 48%)",
    "radial-gradient(ellipse at 80% 85%, rgba(210,170,90,0.7) 0%, transparent 48%)",
    "radial-gradient(ellipse at 52% 48%, rgba(240,210,130,0.35) 0%, transparent 45%)",
    "linear-gradient(155deg, #f5e8c0 0%, #e8d498 35%, #d4bc78 65%, #c4a860 100%)",
  ].join(", "),

  // Paper / handdrawn: soft parchment with warm light from top-left
  handdrawn: [
    "radial-gradient(ellipse at 18% 12%, rgba(255,250,220,0.75) 0%, transparent 48%)",
    "radial-gradient(ellipse at 82% 88%, rgba(220,190,140,0.5) 0%, transparent 48%)",
    "radial-gradient(ellipse at 50% 55%, rgba(250,240,210,0.28) 0%, transparent 55%)",
    "linear-gradient(175deg, #f8f0df 0%, #f0e6ce 35%, #ead8ba 65%, #e0ccaa 100%)",
  ].join(", "),
};

export default function GhibliBackground({ sceneKey }: { sceneKey: string }) {
  const gradient = SCENE_GRADIENTS[sceneKey] ?? SCENE_GRADIENTS.default;
  return <div className="fixed inset-0 z-0" style={{ background: gradient }} />;
}
