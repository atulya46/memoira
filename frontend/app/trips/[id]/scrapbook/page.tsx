"use client";
import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/shared/Navbar";
import { api, TripWithMemories, Scrapbook, Memory, ScrapbookTheme } from "@/lib/api";
import {
  WavyUnderline, InkDots, DaySticker, StarAccent,
  SparkleIcon, MapPinDoodle, PenDoodle,
} from "@/components/trip/HanddrawnDecorations";
import MemoiraLoader from "@/components/shared/MemoiraLoader";

const GhibliBackground = dynamic(() => import("@/components/trip/GhibliBackground"), { ssr: false });

function formatTripDate(start: string, end: string | null | undefined): string {
  const parse = (d: string) => new Date(d + "T12:00:00");
  const fmt = (d: Date, showYear: boolean) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "long", ...(showYear ? { year: "numeric" } : {}) });
  if (!end || end === start) return fmt(parse(start), true);
  const s = parse(start), e = parse(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(s, !sameYear)} – ${fmt(e, true)}`;
}

function normaliseSceneKey(raw: string | undefined): string {
  const k = (raw ?? "default").toLowerCase().trim();
  if (k === "city") return "city_upscale";
  return k;
}

// ─── Theme definitions ────────────────────────────────────────────────────────
const THEMES: Record<ScrapbookTheme, {
  label: string; icon: string;
  pageBg: string; paperBg: string;
  cardBg: string; cardBorder: string;
  glassBg: string; glassBorder: string;
  textPrimary: string; textSecondary: string; textMuted: string;
  accent: string; dayCircle: string; dividerColor: string;
  polaroidBg: string; photoFilter: string;
  decorLeaf: string;
}> = {
  earthy: {
    label: "Earthy", icon: "🌱",
    pageBg: "linear-gradient(160deg, #ddebd0 0%, #f0ead8 50%, #dce8f0 100%)",
    paperBg: "#f7f4ee",
    cardBg: "#ffffff", cardBorder: "1px solid rgba(120,160,90,0.18)",
    glassBg: "rgba(255,255,255,0.38)", glassBorder: "1px solid rgba(255,255,255,0.6)",
    textPrimary: "#2e3e20", textSecondary: "#4a5e3a", textMuted: "#7a8e6a",
    accent: "#7aaa60", dayCircle: "linear-gradient(135deg, #7aaa60, #4e8040)",
    dividerColor: "rgba(120,180,90,0.35)", polaroidBg: "#fff", photoFilter: "none",
    decorLeaf: "🌿",
  },
  vintage: {
    label: "Vintage", icon: "📷",
    pageBg: "linear-gradient(160deg, #ede0c8 0%, #d8c8a8 45%, #c8b898 100%)",
    paperBg: "#f2e8d5",
    cardBg: "#fff8ee", cardBorder: "1px solid rgba(160,120,70,0.25)",
    glassBg: "rgba(255,248,230,0.45)", glassBorder: "1px solid rgba(190,145,75,0.35)",
    textPrimary: "#2a1a08", textSecondary: "#5a3a18", textMuted: "#8a6a40",
    accent: "#8a5a20", dayCircle: "linear-gradient(135deg, #a06030, #6a3a10)",
    dividerColor: "rgba(160,110,50,0.35)", polaroidBg: "#f8f0e0",
    photoFilter: "sepia(50%) saturate(70%) brightness(90%) contrast(105%)",
    decorLeaf: "✉️",
  },
  handdrawn: {
    label: "Paper", icon: "✏️",
    pageBg: "#f0e8d8",
    paperBg: "#f0e8d8",
    cardBg: "rgba(250,244,234,0.92)", cardBorder: "1.5px solid rgba(100,72,44,0.18)",
    glassBg: "rgba(250,244,234,0.75)", glassBorder: "1.5px solid rgba(100,72,44,0.22)",
    textPrimary: "#1a1008", textSecondary: "#3a2510", textMuted: "#7a6040",
    accent: "#8b5e3c", dayCircle: "linear-gradient(135deg, #b07040, #7a4020)",
    dividerColor: "rgba(100,72,44,0.22)", polaroidBg: "#fffdf5",
    photoFilter: "sepia(15%) contrast(105%)",
    decorLeaf: "✏️",
  },
};

const ROTS = [-2, 1.5, -1, 2.5, -1.5, 1, -2.5, 0.8];

export default function ScrapbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<TripWithMemories | null>(null);
  const [scrapbook, setScrapbook] = useState<Scrapbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeError, setThemeError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [doodlesOn, setDoodlesOn] = useState(true);
  const [userName, setUserName] = useState("");
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    // Load preferences from localStorage
    const savedDoodles = localStorage.getItem("memoiraaa_doodles");
    if (savedDoodles !== null) setDoodlesOn(savedDoodles !== "0");
    const savedName = localStorage.getItem("memoiraaa_user_name");
    if (savedName) setUserName(savedName);
    const savedCustomQ = localStorage.getItem(`memoiraaa_custom_q_${id}`);
    if (savedCustomQ) setCustomQuestions(JSON.parse(savedCustomQ) as string[]);

    Promise.all([api.trips.get(id), api.trips.getScrapbook(id)])
      .then(([t, s]) => {
        setTrip(t); setScrapbook(s);
        if (s.is_shared && s.share_token) setShareUrl(`${window.location.origin}/s/${s.share_token}`);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function toggleDoodles() {
    const next = !doodlesOn;
    setDoodlesOn(next);
    localStorage.setItem("memoiraaa_doodles", next ? "1" : "0");
  }

  async function handleShare() {
    if (!scrapbook) return;
    if (shareUrl) { copy(shareUrl); return; }
    setSharing(true);
    try {
      const { share_token } = await api.scrapbooks.share(scrapbook.id);
      const url = `${window.location.origin}/s/${share_token}`;
      setShareUrl(url); copy(url);
    } catch (e) { console.error(e); }
    setSharing(false);
  }

  async function handleDelete() {
    if (!scrapbook || deleting) return;
    if (!confirm("Delete this scrapbook? You can regenerate it anytime from the timeline page.")) return;
    setDeleting(true);
    try {
      await api.scrapbooks.delete(scrapbook.id);
      router.push(`/trips/${id}`);
    } catch (e) { console.error(e); setDeleting(false); }
  }

  async function switchTheme(theme: ScrapbookTheme) {
    if (!scrapbook || savingTheme) return;
    setSavingTheme(true);
    setThemeError(false);
    try {
      await api.scrapbooks.update(scrapbook.id, { theme });
      setScrapbook({ ...scrapbook, theme });
      localStorage.setItem("memoiraaa_last_theme", theme);
    } catch (e) {
      console.error(e);
      setThemeError(true);
    }
    setSavingTheme(false);
  }

  async function handleRegenerate() {
    if (!scrapbook || !confirm("Regenerate scrapbook? This will refresh all AI content from your current memories.")) return;
    setRegenerating(true);
    try {
      // Preserve the current scene_type so the gradient stays consistent
      const prevSceneType = (scrapbook.ai_config as Record<string, unknown>)?.scene_type;
      const updated = await api.trips.generateScrapbook(id);
      if (prevSceneType && updated.ai_config) {
        (updated.ai_config as Record<string, unknown>).scene_type = prevSceneType;
      }
      setScrapbook(updated);
      // Reload trip so newly added memories appear in polaroids/voice notes
      const updatedTrip = await api.trips.get(id);
      setTrip(updatedTrip);
    } catch (e) { console.error(e); }
    setRegenerating(false);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <GhibliBackground sceneKey="default" />
        <div className="relative z-10">
          <Navbar transparent textColor="white" />
          <MemoiraLoader message="Building your scrapbook" />
        </div>
      </div>
    );
  }
  if (!trip || !scrapbook) {
    return (
      <div className="min-h-screen"><Navbar />
        <p className="p-8 text-sm" style={{ color: "#9a8070" }}>
          Scrapbook not found. <button className="underline" onClick={() => router.push(`/trips/${id}`)}>Go back</button>
        </p>
      </div>
    );
  }

  const activeThemeKey: ScrapbookTheme =
    scrapbook.theme === "earthy" || scrapbook.theme === "vintage" || scrapbook.theme === "handdrawn"
      ? (scrapbook.theme as ScrapbookTheme) : "earthy";
  const T = THEMES[activeThemeKey];

  const ai = scrapbook.ai_config as {
    cover_tagline?: string;
    scene_type?: string;
    day_summaries?: Record<string, string>;
    places?: string[];
    highlights?: Record<string, string | null>;
    reflection_prompts?: string[];
  };

  const sceneKey = normaliseSceneKey(ai.scene_type);
  // GhibliBackground now handles all themes — pass theme key for non-earthy themes
  const bgKey = activeThemeKey === "earthy" ? sceneKey : activeThemeKey;

  const sortedPages = [...scrapbook.scrapbook_pages].sort((a, b) => a.day_number - b.day_number);
  const memoriesByDay: Record<number, Memory[]> = {};
  for (const m of trip.memories) {
    if (m.day_assigned != null) {
      memoriesByDay[m.day_assigned] = memoriesByDay[m.day_assigned] ?? [];
      memoriesByDay[m.day_assigned].push(m);
    }
  }
  const highlights = Object.entries(ai.highlights ?? {}).filter(([, v]) => v);

  return (
    <div className="min-h-screen relative">
      {/* Global keyframes + print styles */}
      <style>{`
        @keyframes spin-icon { from { transform: rotate(0deg); } to { transform { rotate(360deg); } } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          nav, .print-hide { display: none !important; }
          body { background: white !important; }
          .fixed { position: static !important; }
          * { box-shadow: none !important; }
          h1, h2 { break-after: avoid; }
          section { break-inside: avoid; }
        }
      `}</style>

      {/* Fixed atmospheric gradient — handled for all themes now */}
      <GhibliBackground sceneKey={bgKey} />

      {/* Scrollable content layer — paper lines live here so they scroll with text */}
      <div className="relative z-10 min-h-screen" style={
        activeThemeKey === "handdrawn" ? {
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(120,80,40,0.055) 27px, rgba(120,80,40,0.055) 28px)",
        } : {}
      }>
        <Navbar transparent textColor={T.textPrimary} />

        {/* Cover */}
        <div style={{ borderBottom: `1px solid ${T.dividerColor}` }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8">
            {trip.cover_image_url && (
              <div className="shrink-0 self-center sm:self-auto" style={{ background: T.polaroidBg, padding: "6px 6px 28px", transform: "rotate(-2deg)", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}>
                <img src={trip.cover_image_url} alt="cover" style={{ width: 110, height: 110, objectFit: "cover", filter: T.photoFilter }} />
              </div>
            )}
            <div className="flex-1 space-y-2 w-full">
              <p className="font-[family-name:var(--font-caveat)] text-base sm:text-lg" style={{ color: T.textMuted }}>
                {formatTripDate(trip.start_date, trip.end_date)}
              </p>
              <h1 className="font-[family-name:var(--font-caveat)] text-4xl sm:text-5xl font-bold leading-tight" style={{ color: T.textPrimary }}>
                {trip.name}
              </h1>
              {doodlesOn && <WavyUnderline color={T.accent} width={220} />}
              {ai.cover_tagline && (
                <p className="font-[family-name:var(--font-caveat)] text-2xl" style={{ color: T.textSecondary }}>
                  {ai.cover_tagline}
                </p>
              )}
              {doodlesOn && (
                <div className="pt-1">
                  <StarAccent color={T.accent} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-2 print-hide">
                {/* Custom theme dropdown */}
                <ThemeDropdown value={activeThemeKey} onChange={switchTheme} disabled={savingTheme} T={T} />

                {/* Doodles toggle */}
                <button
                  onClick={toggleDoodles}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-opacity hover:opacity-75 font-[family-name:var(--font-caveat)]"
                  style={{
                    border: `1px solid ${T.dividerColor}`,
                    background: doodlesOn ? `${T.accent}22` : "transparent",
                    color: T.textMuted,
                    fontSize: "15px",
                  }}>
                  <PenDoodle color={doodlesOn ? T.accent : T.textMuted} size={14} />
                  <span className="hidden sm:inline">{doodlesOn ? "Doodles on" : "Doodles off"}</span>
                </button>

                {/* ← Memories */}
                <button onClick={() => router.push(`/trips/${id}?memories=1`)}
                  className="font-[family-name:var(--font-caveat)] text-base px-3 py-1.5 rounded-xl transition-opacity hover:opacity-75"
                  style={{ border: `1px solid ${T.dividerColor}`, color: T.textSecondary }}>
                  ← Memories
                </button>

                {/* Regenerate */}
                <IconBtn label="Regenerate" onClick={handleRegenerate} disabled={regenerating}
                  style={{ border: `1px solid ${T.dividerColor}`, color: T.textSecondary }}>
                  {regenerating
                    ? <svg width="15" height="15" viewBox="0 0 15 15" style={{ animation: "spin 1s linear infinite" }}><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="20" strokeDashoffset="8"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 7.5A5.5 5.5 0 1 1 7.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><polyline points="2,4 2,8 6,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </IconBtn>

                {/* Share */}
                <IconBtn label={copied ? "Copied!" : "Share"} onClick={handleShare} disabled={sharing}
                  style={{ border: `1px solid ${T.dividerColor}`, color: copied ? T.accent : T.textSecondary, background: copied ? `${T.accent}18` : "transparent" }}>
                  {copied
                    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="11" cy="2.5" r="1.8" stroke="currentColor" strokeWidth="1.3"/><circle cx="11" cy="11.5" r="1.8" stroke="currentColor" strokeWidth="1.3"/><circle cx="3" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.3"/><line x1="4.7" y1="6.1" x2="9.3" y2="3.4" stroke="currentColor" strokeWidth="1.3"/><line x1="4.7" y1="7.9" x2="9.3" y2="10.6" stroke="currentColor" strokeWidth="1.3"/></svg>}
                </IconBtn>

                {/* Export PDF */}
                <IconBtn label="Export PDF" onClick={() => window.print()}
                  style={{ border: `1px solid ${T.dividerColor}`, color: T.textSecondary }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="1" width="8" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                    <line x1="4" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    <line x1="4" y1="6.5" x2="8" y2="6.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    <line x1="4" y1="8.5" x2="6.5" y2="8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                    <path d="M9 9.5 L12 9.5 M10.5 8 L10.5 11 M10.5 11 L9.2 9.8 M10.5 11 L11.8 9.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </IconBtn>

                {/* Delete */}
                <IconBtn label={deleting ? "Deleting…" : "Delete"} onClick={handleDelete} disabled={deleting}
                  style={{ border: "1px solid rgba(180,40,40,0.3)", color: "#c0392b" }}>
                  <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
                    <path d="M1 3h11M4.5 3V2h4v1M2 3l.8 9.2A1 1 0 0 0 3.8 13h5.4a1 1 0 0 0 1-.8L11 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="8" y1="6" x2="8" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                </IconBtn>
              </div>

              {themeError && (
                <p className="text-xs mt-0.5 font-[family-name:var(--font-caveat)]" style={{ color: "#c0392b" }}>
                  Couldn&apos;t switch to Paper theme — run the DB migration in Supabase first.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 sm:space-y-16">

          {/* Day spreads */}
          {sortedPages.map((page, idx) => {
            const dayMems = memoriesByDay[page.day_number] ?? [];
            const photos = dayMems.filter(m => m.type === "photo" && m.file_url);
            const voices = dayMems.filter(m => m.type === "voice");
            const notes = dayMems.filter(m => m.type === "note");
            const summary = page.ai_summary || ai.day_summaries?.[String(page.day_number)] || "";
            const date = new Date(trip.start_date + "T12:00:00");
            date.setDate(date.getDate() + page.day_number - 1);
            const dateLabel = date.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
            const flip = idx % 2 === 1;

            return (
              <section key={page.id}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full flex flex-col items-center justify-center shadow-md shrink-0"
                    style={{ background: T.dayCircle, color: "#fff" }}>
                    <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Day</span>
                    <span className="text-xl font-bold leading-none">{page.day_number}</span>
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-caveat)] text-2xl font-bold" style={{ color: T.textPrimary }}>{dateLabel}</p>
                    {page.location_label && (
                      <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: T.textMuted }}>{page.location_label}</p>
                    )}
                  </div>
                  <span className="ml-auto select-none">
                    {doodlesOn
                      ? <DaySticker dayIndex={idx} color={T.accent} />
                      : <span className="text-2xl opacity-25">{T.decorLeaf}</span>}
                  </span>
                </div>

                {/* Spread */}
                <div className={flip
                  ? "flex flex-col gap-6 sm:gap-8 sm:flex-row-reverse items-start"
                  : "flex flex-col gap-6 sm:gap-8 sm:flex-row items-start"}>
                  {photos.length > 0 && (
                    <div className="shrink-0">
                      <PhotoMosaic photos={photos} theme={T} />
                    </div>
                  )}
                  <div className="flex-1 space-y-4 py-2">
                    {summary && (
                      <p className="font-[family-name:var(--font-caveat)] text-2xl leading-relaxed" style={{ color: T.textSecondary }}>
                        {summary}
                      </p>
                    )}
                    {voices.length > 0 && (
                      <div className="space-y-2">
                        {voices.map(m => {
                          const linkedPhotoId = m.ai_metadata?.linked_photo_id as string | undefined;
                          const linkedPhoto = linkedPhotoId
                            ? trip.memories.find(x => x.id === linkedPhotoId && x.file_url)
                            : undefined;
                          return (
                            <div key={m.id} className="rounded-2xl px-4 py-3 space-y-2"
                              style={{ background: T.glassBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: T.glassBorder }}>
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  {m.file_url && <ThemedAudioPlayer src={m.file_url} accent={T.accent} glassBg={T.glassBg} glassBorder={T.glassBorder} />}
                                </div>
                                {linkedPhoto && (
                                  <div className="shrink-0" style={{ background: T.polaroidBg, padding: "4px 4px 16px", transform: "rotate(1.5deg)", boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }}>
                                    <img src={linkedPhoto.file_url!} alt="linked" style={{ width: 56, height: 56, objectFit: "cover", filter: T.photoFilter }} />
                                  </div>
                                )}
                              </div>
                              {((m.ai_metadata?.key_anecdote as string) || (m.ai_metadata?.emotional_tone as string)) && (
                                <p className="font-[family-name:var(--font-caveat)] text-lg leading-snug" style={{ color: T.textSecondary }}>
                                  {(m.ai_metadata?.key_anecdote as string) || (m.ai_metadata?.emotional_tone as string)}
                                </p>
                              )}
                              <p className="font-[family-name:var(--font-caveat)] text-xs" style={{ color: T.textMuted, opacity: 0.65 }}>
                                {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {notes.length > 0 && (
                      <div className="space-y-2">
                        {notes.map(m => (
                          <div key={m.id} className="rounded-2xl px-4 py-3 space-y-1"
                            style={{ background: T.glassBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: T.glassBorder }}>
                            <ExpandableNote content={m.content ?? ""} theme={T} />
                            <p className="font-[family-name:var(--font-caveat)] text-xs pt-1" style={{ color: T.textMuted, opacity: 0.65 }}>
                              {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="mt-10 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${T.dividerColor}, transparent)` }} />
                  {doodlesOn ? <InkDots color={T.accent} /> : <span className="text-xs opacity-30 select-none">✦</span>}
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, ${T.dividerColor}, transparent)` }} />
                </div>
              </section>
            );
          })}

          {/* Unassigned voice/notes */}
          {(() => {
            const unassigned = trip.memories.filter(
              m => m.day_assigned == null && (m.type === "voice" || m.type === "note")
            );
            if (unassigned.length === 0) return null;
            return (
              <section className="space-y-4">
                <h2 className="font-[family-name:var(--font-caveat)] text-3xl font-bold" style={{ color: T.textPrimary }}>
                  Other memories
                </h2>
                {doodlesOn && <WavyUnderline color={T.accent} />}
                <div className="space-y-3">
                  {unassigned.map(m => m.type === "voice" ? (
                    <div key={m.id} className="rounded-2xl px-4 py-3 space-y-2"
                      style={{ background: T.glassBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: T.glassBorder }}>
                      {m.file_url && <ThemedAudioPlayer src={m.file_url} accent={T.accent} glassBg={T.glassBg} glassBorder={T.glassBorder} />}
                      {((m.ai_metadata?.key_anecdote as string) || (m.ai_metadata?.emotional_tone as string)) && (
                        <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: T.textSecondary }}>
                          {(m.ai_metadata?.key_anecdote as string) || (m.ai_metadata?.emotional_tone as string)}
                        </p>
                      )}
                      <p className="font-[family-name:var(--font-caveat)] text-xs" style={{ color: T.textMuted, opacity: 0.65 }}>
                        {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  ) : (
                    <div key={m.id} className="rounded-2xl px-4 py-3 space-y-1"
                      style={{ background: T.glassBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: T.glassBorder }}>
                      <ExpandableNote content={m.content ?? ""} theme={T} />
                      <p className="font-[family-name:var(--font-caveat)] text-xs pt-1" style={{ color: T.textMuted, opacity: 0.65 }}>
                        {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          {/* Places */}
          {ai.places && ai.places.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="font-[family-name:var(--font-caveat)] text-3xl font-bold" style={{ color: T.textPrimary }}>
                  Places on this journey
                </h2>
                {doodlesOn && <InkDots color={T.accent} />}
              </div>
              {doodlesOn && <WavyUnderline color={T.accent} />}
              <div className="flex flex-wrap gap-2">
                {ai.places.map((place, i) => (
                  <a
                    key={i}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-[family-name:var(--font-caveat)] text-base font-medium transition-opacity hover:opacity-75"
                    style={{
                      background: T.glassBg,
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      border: T.glassBorder,
                      color: T.textSecondary,
                      textDecoration: "none",
                    }}>
                    {place}
                    <MapPinDoodle color={T.accent} size={13} />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <section className="space-y-5">
              <h2 className="font-[family-name:var(--font-caveat)] text-3xl font-bold flex items-center gap-2" style={{ color: T.textPrimary }}>
                Highlights
                {doodlesOn
                  ? <SparkleIcon color={T.accent} size={28} />
                  : <span className="opacity-70">✨</span>}
              </h2>
              {doodlesOn && <WavyUnderline color={T.accent} />}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {highlights.map(([key, value]) => (
                  <div key={key} className="rounded-2xl px-4 py-3 space-y-1"
                    style={{ background: T.glassBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: T.glassBorder }}>
                    <p className="font-[family-name:var(--font-caveat)] text-sm uppercase tracking-wider" style={{ color: T.textMuted }}>{key.replace(/_/g, " ")}</p>
                    <p className="font-[family-name:var(--font-caveat)] text-xl" style={{ color: T.textPrimary }}>{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Letters to yourself — always shown so user can add their own questions */}
          <section className="space-y-4 pb-16">
            <h2 className="font-[family-name:var(--font-caveat)] text-3xl font-bold" style={{ color: T.textPrimary }}>
              Letters to yourself
            </h2>
            {doodlesOn && <WavyUnderline color={T.accent} />}
            {userName && (
              <p className="font-[family-name:var(--font-caveat)] text-lg opacity-60" style={{ color: T.textSecondary }}>
                Dear {userName}, here are some things to think about…
              </p>
            )}
            {((ai.reflection_prompts ?? []).length > 0 || customQuestions.length > 0) && (
              <ul className="space-y-4">
                {(ai.reflection_prompts ?? []).map((prompt, i) => (
                  <ReflectionItem key={`ai-${i}`} prompt={prompt} tripId={id} theme={T} />
                ))}
                {customQuestions.map((prompt, i) => (
                  <ReflectionItem key={`custom-${i}`} prompt={prompt} tripId={id} theme={T} />
                ))}
              </ul>
            )}
            <div className="mt-2">
              <AddCustomQuestion
                tripId={id}
                theme={T}
                onAdd={(q) => setCustomQuestions(prev => [...prev, q])}
              />
            </div>
          </section>

        </div>{/* max-w-5xl */}
      </div>{/* z-10 scrollable wrapper */}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type ThemeConfig = typeof THEMES[ScrapbookTheme];
const NOTE_COLLAPSE_CHARS = 350;

function ExpandableNote({ content, theme: T }: { content: string; theme: ThemeConfig }) {
  const [expanded, setExpanded] = useState(false);
  const long = content.length > NOTE_COLLAPSE_CHARS;
  const displayed = long && !expanded ? content.slice(0, NOTE_COLLAPSE_CHARS).trimEnd() + "…" : content;
  return (
    <div>
      <p className="font-[family-name:var(--font-caveat)] text-lg leading-snug" style={{ color: T.textSecondary }}>
        {displayed}
      </p>
      {long && (
        <button onClick={() => setExpanded(v => !v)} className="font-[family-name:var(--font-caveat)] text-sm mt-1 font-medium" style={{ color: T.accent }}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

function ReflectionItem({ prompt, tripId, theme: T }: { prompt: string; tripId: string; theme: ThemeConfig }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAnswer, setSavedAnswer] = useState("");

  async function handleSave() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      await api.memories.processNote({
        trip_id: tripId,
        content: `Reflection — ${prompt}\n\n${content}`,
      });
      setSavedAnswer(content);
      setContent("");
      setOpen(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <li className="space-y-2">
      <div className="flex gap-3 items-start">
        <span className="shrink-0 mt-1 text-lg" style={{ color: T.accent }}>—</span>
        <p className="font-[family-name:var(--font-caveat)] text-xl" style={{ color: T.textSecondary }}>{prompt}</p>
      </div>

      {/* Saved answer display */}
      {savedAnswer && !open && (
        <div className="ml-6 rounded-xl px-4 py-3 space-y-1.5"
          style={{ background: T.glassBg, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: T.glassBorder }}>
          <p className="font-[family-name:var(--font-caveat)] text-lg leading-snug" style={{ color: T.textPrimary }}>
            {savedAnswer}
          </p>
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-caveat)] text-sm opacity-55" style={{ color: T.accent }}>
              ✓ Saved to memories
            </span>
            <button
              onClick={() => { setContent(savedAnswer); setOpen(true); }}
              className="font-[family-name:var(--font-caveat)] text-sm opacity-55 hover:opacity-90 transition-opacity"
              style={{ color: T.accent }}>
              Edit →
            </button>
          </div>
        </div>
      )}

      {/* Write CTA */}
      {!open && !savedAnswer && (
        <button
          onClick={() => setOpen(true)}
          className="ml-6 font-[family-name:var(--font-caveat)] text-base opacity-55 hover:opacity-90 transition-opacity"
          style={{ color: T.accent }}>
          Write your thoughts →
        </button>
      )}

      {/* Input form */}
      {open && (
        <div className="ml-6 space-y-2">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            placeholder="Your thoughts…"
            className="w-full rounded-xl p-3 text-lg resize-none outline-none font-[family-name:var(--font-caveat)]"
            style={{
              background: T.glassBg,
              border: T.glassBorder,
              color: T.textPrimary,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="font-[family-name:var(--font-caveat)] text-base px-4 py-1.5 rounded-xl transition-opacity"
              style={{
                background: T.accent,
                color: "#fff",
                opacity: !content.trim() || saving ? 0.5 : 1,
              }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setOpen(false); setContent(""); }}
              className="font-[family-name:var(--font-caveat)] text-base px-4 py-1.5 rounded-xl"
              style={{ border: T.glassBorder, color: T.textMuted }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddCustomQuestion({ tripId, theme: T, onAdd }: { tripId: string; theme: ThemeConfig; onAdd: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function handleAdd() {
    const q = text.trim();
    if (!q) return;
    onAdd(q);
    // Persist custom questions per trip in localStorage
    const key = `memoiraaa_custom_q_${tripId}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
    localStorage.setItem(key, JSON.stringify([...existing, q]));
    setText("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-[family-name:var(--font-caveat)] text-base opacity-55 hover:opacity-90 transition-opacity flex items-center gap-1.5"
        style={{ color: T.accent }}>
        + Add your own question
      </button>
    );
  }

  return (
    <div className="rounded-xl px-4 py-3 space-y-2"
      style={{ background: T.glassBg, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", border: T.glassBorder }}>
      <p className="font-[family-name:var(--font-caveat)] text-sm uppercase tracking-wider" style={{ color: T.textMuted }}>
        Your question
      </p>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setOpen(false); setText(""); } }}
        placeholder="What did this trip teach you?"
        className="w-full bg-transparent outline-none font-[family-name:var(--font-caveat)] text-lg"
        style={{ color: T.textPrimary }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!text.trim()}
          className="font-[family-name:var(--font-caveat)] text-base px-4 py-1.5 rounded-xl transition-opacity"
          style={{ background: T.accent, color: "#fff", opacity: !text.trim() ? 0.5 : 1 }}>
          Add
        </button>
        <button
          onClick={() => { setOpen(false); setText(""); }}
          className="font-[family-name:var(--font-caveat)] text-base px-4 py-1.5 rounded-xl"
          style={{ border: T.glassBorder, color: T.textMuted }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PhotoMosaic({ photos, theme: T }: { photos: Memory[]; theme: ThemeConfig }) {
  if (photos.length === 1) return <Polaroid memory={photos[0]} rotation={ROTS[0]} size="lg" theme={T} />;
  if (photos.length === 2) {
    return (
      <div className="flex gap-4 items-start">
        <Polaroid memory={photos[0]} rotation={ROTS[0]} theme={T} />
        <Polaroid memory={photos[1]} rotation={ROTS[1]} theme={T} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Polaroid memory={photos[0]} rotation={ROTS[0]} size="lg" theme={T} />
      <div className="flex gap-3 flex-wrap">
        {photos.slice(1).map((m, i) => (
          <Polaroid key={m.id} memory={m} rotation={ROTS[(i + 1) % ROTS.length]} size="sm" theme={T} />
        ))}
      </div>
    </div>
  );
}

function Polaroid({ memory, rotation, size = "md", theme: T }: {
  memory: Memory; rotation: number; size?: "sm" | "md" | "lg"; theme: ThemeConfig;
}) {
  const desc = (memory.ai_metadata?.description as string) || "";
  // Responsive: slightly smaller on mobile
  const dims = { sm: { mobile: 80, desk: 100 }, md: { mobile: 110, desk: 140 }, lg: { mobile: 150, desk: 200 } };
  const d = dims[size];
  return (
    <div className="shrink-0 inline-block hover:scale-105 transition-transform duration-200"
      style={{ background: T.polaroidBg, padding: "6px 6px 28px", transform: `rotate(${rotation}deg)`, boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}>
      <img src={memory.file_url!} alt={desc}
        className="block object-cover"
        style={{
          width: `clamp(${d.mobile}px, 20vw, ${d.desk}px)`,
          height: `clamp(${d.mobile}px, 20vw, ${d.desk}px)`,
          filter: T.photoFilter,
        }} />
    </div>
  );
}

function ThemedAudioPlayer({ src, accent, glassBg, glassBorder }: {
  src: string; accent: string; glassBg: string; glassBorder: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isDragging = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    function handleDurationChange() {
      if (!isFinite(audio!.duration)) {
        // webm/opus files often report Infinity — ghost-seek to the end so the browser
        // discovers the real duration from the seekable range, then reset to start.
        audio!.addEventListener("seeked", function onSeeked() {
          audio!.removeEventListener("seeked", onSeeked);
          const end =
            audio!.seekable.length > 0
              ? audio!.seekable.end(audio!.seekable.length - 1)
              : 0;
          if (isFinite(end) && end > 0) {
            setDuration(end);
            setProgress(0);
          }
          audio!.currentTime = 0;
        }, { once: true });
        audio!.currentTime = 1e10;
      }
    }
    audio.addEventListener("durationchange", handleDurationChange);
    return () => audio.removeEventListener("durationchange", handleDurationChange);
  }, []);

  function getDuration(audio: HTMLAudioElement): number {
    if (isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    if (audio.seekable.length > 0) {
      const end = audio.seekable.end(audio.seekable.length - 1);
      if (isFinite(end) && end > 0) return end;
    }
    return 0;
  }

  function syncProgress(audio: HTMLAudioElement) {
    const nextDuration = getDuration(audio);
    if (nextDuration > 0) {
      setDuration(nextDuration);
      setProgress(Math.min(1, Math.max(0, audio.currentTime / nextDuration)));
    }
    setCurrentTime(audio.currentTime);
  }

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }

  function seekToX(clientX: number) {
    const a = audioRef.current;
    const track = trackRef.current;
    if (!a || !track) return;
    const nextDuration = getDuration(a);
    if (nextDuration <= 0) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = pct * nextDuration;
    setProgress(pct);
    setCurrentTime(a.currentTime);
    setDuration(nextDuration);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekToX(e.clientX);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (isDragging.current) seekToX(e.clientX);
  }

  function handlePointerUp() {
    isDragging.current = false;
  }

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-2"
      style={{ background: glassBg, border: glassBorder, maxWidth: "280px", backdropFilter: "blur(8px)" }}>
      <audio ref={audioRef} src={src} preload="metadata"
        onTimeUpdate={e => syncProgress(e.currentTarget)}
        onLoadedMetadata={e => syncProgress(e.currentTarget)}
        onDurationChange={e => syncProgress(e.currentTarget)}
        onProgress={e => syncProgress(e.currentTarget)}
        onPause={() => setPlaying(false)}
        onPlay={e => { setPlaying(true); syncProgress(e.currentTarget); }}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime(0); }} />
      <button onClick={toggle}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-75"
        style={{ background: accent, color: "#fff" }}>
        {playing ? (
          <svg width="8" height="8" viewBox="0 0 8 8">
            <rect x="0" y="0" width="2.5" height="8" rx="0.5" fill="currentColor"/>
            <rect x="5.5" y="0" width="2.5" height="8" rx="0.5" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="8" height="9" viewBox="0 0 8 9">
            <polygon points="1,0.5 7.5,4.5 1,8.5" fill="currentColor"/>
          </svg>
        )}
      </button>
      <div className="flex-1 space-y-1 min-w-0">
        {/* Taller hit area for easy tap/drag */}
        <div ref={trackRef}
          className="w-full flex items-center cursor-pointer select-none touch-none"
          style={{ height: 24 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}>
          <div className="w-full h-2 rounded-full relative" style={{ background: "rgba(0,0,0,0.12)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: accent }} />
            <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full shadow-sm"
              style={{ left: `${progress * 100}%`, transform: "translate(-50%, -50%)", background: accent }} />
          </div>
        </div>
        <div className="flex justify-between">
          <span style={{ fontSize: "10px", fontFamily: "var(--font-caveat)", color: accent }}>{fmt(currentTime)}</span>
          {duration > 0 && isFinite(duration) && <span style={{ fontSize: "10px", fontFamily: "var(--font-caveat)", color: accent, opacity: 0.55 }}>{fmt(duration)}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Icon button with hover tooltip ──────────────────────────────────────────
function IconBtn({ onClick, disabled, label, children, style, className = "" }: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-75 disabled:opacity-40 ${className}`}
        style={style}>
        {children}
      </button>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-0.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          fontFamily: "var(--font-caveat)",
          fontSize: 13,
          background: "rgba(30,20,10,0.78)",
          color: "#fff",
          zIndex: 60,
        }}>
        {label}
      </span>
    </div>
  );
}

// ─── Custom theme dropdown (native <select> can't use custom fonts in options) ─
function ThemeDropdown({ value, onChange, disabled, T }: {
  value: ScrapbookTheme;
  onChange: (v: ScrapbookTheme) => void;
  disabled?: boolean;
  T: ThemeConfig;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className="font-[family-name:var(--font-caveat)] text-base px-3 py-1.5 rounded-xl outline-none transition-opacity disabled:opacity-50 flex items-center gap-2"
        style={{
          border: `1px solid ${T.dividerColor}`,
          background: T.glassBg,
          color: T.textSecondary,
          backdropFilter: "blur(8px)",
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: 115,
        }}>
        <span>{THEMES[value].icon} {THEMES[value].label}</span>
        <svg width="9" height="5" viewBox="0 0 9 5" fill="none"
          className={`ml-auto shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l3.5 3L8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 rounded-xl overflow-hidden shadow-xl z-50"
          style={{
            background: T.glassBg,
            border: `1px solid ${T.dividerColor}`,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            minWidth: 130,
          }}>
          {(Object.keys(THEMES) as ScrapbookTheme[]).map(key => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full px-3 py-2 text-left font-[family-name:var(--font-caveat)] text-base flex items-center gap-2 transition-opacity hover:opacity-75"
              style={{
                color: key === value ? T.accent : T.textSecondary,
                fontWeight: key === value ? 600 : 400,
                background: key === value ? `${T.accent}18` : "transparent",
              }}>
              <span>{THEMES[key].icon}</span>
              <span>{THEMES[key].label}</span>
              {key === value && <span className="ml-auto text-xs opacity-70">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
