"use client";
import React, { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import VoiceRecorder from "@/components/upload/VoiceRecorder";
import NoteEditor from "@/components/upload/NoteEditor";
import MemoryCard from "@/components/memory/MemoryCard";
import { Button } from "@/components/ui/button";
import { api, TripWithMemories } from "@/lib/api";
import { uploadPhoto } from "@/lib/storage";
import { CameraDoodle, MicDoodle, NotePenDoodle } from "@/components/trip/HanddrawnDecorations";
import MemoiraLoader from "@/components/shared/MemoiraLoader";

const MAX_PHOTOS = 20;

type HubTab = "memories" | "scrapbook";
type MemorySubTab = "photos" | "notes";
type UploadType = "photos" | "voice" | "notes" | null;

function formatTripDate(start: string, end: string | null | undefined): string {
  const parse = (d: string) => new Date(d + "T12:00:00");
  const fmt = (d: Date, showYear: boolean) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "long", ...(showYear ? { year: "numeric" } : {}) });
  if (!end || end === start) return fmt(parse(start), true);
  const s = parse(start), e = parse(end);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${fmt(s, !sameYear)} – ${fmt(e, true)}`;
}

export default function TripPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ memories?: string }>;
}) {
  const { id } = use(params);
  const { memories: memoriesParam } = use(searchParams);
  const router = useRouter();
  const [trip, setTrip] = useState<TripWithMemories | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<HubTab>("memories");
  const [memorySubTab, setMemorySubTab] = useState<MemorySubTab>("photos");
  const [reconstructing, setReconstructing] = useState(false);
  const [activeUpload, setActiveUpload] = useState<UploadType>(null);
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<string | null>(null);

  async function load() {
    const data = await api.trips.get(id);
    setTrip(data);
    // Auto-redirect to scrapbook if ready, unless user navigated back explicitly
    if (data.status === "ready" && !memoriesParam) {
      router.replace(`/trips/${id}/scrapbook`);
      return;
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleLinkMemories() {
    setLinking(true);
    setLinkResult(null);
    try {
      const displayName = (typeof window !== "undefined" ? localStorage.getItem("memoiraaa_user_name") : "") ?? "";
      const result = await api.trips.linkMemories(id, displayName);
      const n = result.linked.length;
      setLinkResult(n > 0 ? `Linked ${n} voice note${n !== 1 ? "s" : ""} to photos!` : "No new links found — try adding more photos near your voice notes.");
      if (n > 0) load();
    } catch { setLinkResult("Couldn't run linking — try again."); }
    setLinking(false);
  }

  async function handleReconstruct() {
    setReconstructing(true);
    try {
      await api.trips.reconstruct(id);
      router.push(`/trips/${id}/reconstruct`);
    } catch { setReconstructing(false); }
  }

  if (loading) return <Shell><MemoiraLoader message="Loading journal" /></Shell>;
  if (!trip) return <Shell><p className="p-8 text-sm" style={{ color: "#9a8070" }}>Journal not found.</p></Shell>;

  const photos = trip.memories.filter((m) => m.type === "photo");
  const notesAndVoice = trip.memories.filter((m) => m.type === "voice" || m.type === "note");
  const photoCount = photos.length;
  const canTimeline = trip.memories.length >= 3;
  const canScrapbook = trip.status === "ready";

  function toggleUpload(type: UploadType) {
    setActiveUpload(prev => prev === type ? null : type);
  }

  // When switching to photos sub-tab, only show photo upload; same for notes
  function handleSubTab(tab: MemorySubTab) {
    setMemorySubTab(tab);
    // Clear upload panel when switching sub-tabs
    if (tab === "photos" && activeUpload !== "photos") setActiveUpload(null);
    if (tab === "notes" && activeUpload === "photos") setActiveUpload(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #fdf8f3 0%, #f7efe6 100%)" }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Trip header */}
        <div className="space-y-1">
          <button onClick={() => router.push("/")} className="text-xs mb-2 flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: "#9a8070" }}>
            ← All journals
          </button>
          <h1 className="text-4xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#1a1008" }}>{trip.name}</h1>
          <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#9a8070" }}>
            {formatTripDate(trip.start_date, trip.end_date)}
          </p>
        </div>

        {/* Hub navigation */}
        <div className="grid grid-cols-2 gap-3">
          <HubCard
            active={activeTab === "memories"}
            onClick={() => setActiveTab("memories")}
            icon="📷"
            label="Memories"
            sub={`${trip.memories.length} added`}
          />
          <HubCard
            active={activeTab === "scrapbook"}
            onClick={() => {
              if (canScrapbook) router.push(`/trips/${id}/scrapbook`);
              else setActiveTab("scrapbook");
            }}
            icon="📖"
            label="Scrapbook"
            sub={canScrapbook ? "view scrapbook" : "generate after timeline"}
            disabled={!canScrapbook && trip.status !== "reconstructing"}
          />
        </div>

        {/* Memories tab content */}
        {activeTab === "memories" && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-caveat)] text-2xl font-bold" style={{ color: "#1a1008" }}>
                {trip.memories.length > 0 ? `${trip.memories.length} memories` : "Your memories"}
              </h2>
            </div>

            {/* Sub-tab switcher */}
            <div className="flex gap-1 rounded-xl p-1 w-fit" style={{ background: "rgba(139,94,60,0.08)" }}>
              <button
                onClick={() => handleSubTab("photos")}
                className="px-4 py-1.5 rounded-lg font-[family-name:var(--font-caveat)] text-base transition-all"
                style={{
                  background: memorySubTab === "photos" ? "rgba(255,255,255,0.85)" : "transparent",
                  color: memorySubTab === "photos" ? "#8b5e3c" : "#9a8070",
                  fontWeight: memorySubTab === "photos" ? 600 : 400,
                  boxShadow: memorySubTab === "photos" ? "0 1px 4px rgba(139,94,60,0.15)" : "none",
                }}>
                📷 Photos {photoCount > 0 && `(${photoCount})`}
              </button>
              <button
                onClick={() => handleSubTab("notes")}
                className="px-4 py-1.5 rounded-lg font-[family-name:var(--font-caveat)] text-base transition-all"
                style={{
                  background: memorySubTab === "notes" ? "rgba(255,255,255,0.85)" : "transparent",
                  color: memorySubTab === "notes" ? "#8b5e3c" : "#9a8070",
                  fontWeight: memorySubTab === "notes" ? 600 : 400,
                  boxShadow: memorySubTab === "notes" ? "0 1px 4px rgba(139,94,60,0.15)" : "none",
                }}>
                ✍️ Notes & Voice {notesAndVoice.length > 0 && `(${notesAndVoice.length})`}
              </button>
            </div>

            {/* Expandable upload panel — only for voice & notes (photo has inline tile) */}
            {(activeUpload === "voice" || activeUpload === "notes") && (
              <div className="rounded-2xl p-5 space-y-2 border"
                style={{ background: "rgba(250,244,234,0.9)", borderColor: "rgba(139,94,60,0.2)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#9a8070" }}>
                    {activeUpload === "voice" ? "🎙 Record a voice note" : "✍️ Write a note"}
                  </p>
                  <button onClick={() => setActiveUpload(null)} className="text-xs opacity-50 hover:opacity-100 transition-opacity" style={{ color: "#9a8070" }}>✕</button>
                </div>
                {activeUpload === "voice" && <VoiceRecorder tripId={id} onUploaded={() => { load(); setActiveUpload(null); }} />}
                {activeUpload === "notes" && <NoteEditor tripId={id} onUploaded={() => { load(); setActiveUpload(null); }} />}
              </div>
            )}

            {/* PHOTOS sub-tab */}
            {memorySubTab === "photos" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Inline photo upload tile — no panel needed */}
                <PhotoUploadTile count={photoCount} tripId={id} onUploaded={load} />
                {photos.map((m) => <MemoryCard key={m.id} memory={m} onDeleted={load} />)}
                {photos.length === 0 && !activeUpload && (
                  <div className="col-span-3 text-center py-10">
                    <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#9a8070" }}>
                      No photos yet — tap the tile above to add some.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* NOTES & VOICE sub-tab */}
            {memorySubTab === "notes" && (
              <div className="space-y-3">
                {/* Upload tiles for voice + notes */}
                <div className="grid grid-cols-2 gap-3">
                  <UploadTile active={activeUpload === "voice"} type="voice" onClick={() => toggleUpload("voice")} />
                  <UploadTile active={activeUpload === "notes"} type="notes" onClick={() => toggleUpload("notes")} />
                </div>
                {/* AI voice-photo linking */}
                {notesAndVoice.some(m => m.type === "voice") && photos.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleLinkMemories}
                      disabled={linking}
                      className="font-[family-name:var(--font-caveat)] text-sm px-3 py-1.5 rounded-xl transition-opacity hover:opacity-80"
                      style={{ border: "1px solid rgba(139,94,60,0.25)", color: "#8b5e3c", background: "rgba(250,244,234,0.7)" }}>
                      {linking ? "Matching…" : "🔗 Match voice to photos"}
                    </button>
                    {linkResult && (
                      <span className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: "#7a6040" }}>{linkResult}</span>
                    )}
                  </div>
                )}
                {notesAndVoice.length === 0 && !activeUpload && (
                  <p className="text-center text-sm py-6" style={{ color: "#9a8070" }}>
                    No notes or voice recordings yet — tap a tile above to start.
                  </p>
                )}
                {/* List view — full width, no grid so expand doesn't affect layout */}
                <div className="space-y-3">
                  {notesAndVoice.map((m) => <MemoryCard key={m.id} memory={m} onDeleted={load} />)}
                </div>
              </div>
            )}

            {/* Build timeline CTA */}
            {canTimeline && trip.status === "draft" && (
              <div className="rounded-2xl p-5 flex items-center justify-between gap-4 border"
                style={{ background: "rgba(250,244,234,0.9)", borderColor: "rgba(139,94,60,0.2)" }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#1a1008" }}>Ready to build your timeline?</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9a8070" }}>AI will group your {trip.memories.length} memories by day.</p>
                </div>
                <Button onClick={handleReconstruct} disabled={reconstructing} className="shrink-0"
                  style={{ background: "#5a7a40", color: "#fff", border: "none" }}>
                  {reconstructing ? "Weaving your story…" : "Build timeline →"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Scrapbook tab — info */}
        {activeTab === "scrapbook" && !canScrapbook && (
          <div className="rounded-2xl border p-8 text-center space-y-3"
            style={{ background: "rgba(250,244,234,0.9)", borderColor: "rgba(139,94,60,0.2)" }}>
            <p className="font-[family-name:var(--font-caveat)] text-2xl font-bold" style={{ color: "#1a1008" }}>Scrapbook not generated yet</p>
            <p className="text-sm" style={{ color: "#9a8070" }}>
              {trip.status === "reconstructing"
                ? "Go to Timeline → Generate scrapbook."
                : "First reconstruct the timeline, then generate the scrapbook."}
            </p>
            {trip.status === "reconstructing" && (
              <Link href={`/trips/${id}/reconstruct`}>
                <Button className="mt-2" style={{ background: "#5a7a40", color: "#fff", border: "none" }}>Go to timeline →</Button>
              </Link>
            )}
          </div>
        )}

        {/* Status banners */}
        {trip.status === "reconstructing" && activeTab === "memories" && (
          <div className="rounded-2xl border p-4 flex items-center justify-between"
            style={{ background: "#fef9ec", borderColor: "#f0d060" }}>
            <p className="text-sm" style={{ color: "#7a5800" }}>Timeline reconstructed — review it before generating your journal.</p>
            <Link href={`/trips/${id}/reconstruct`}><Button size="sm" variant="outline">View timeline</Button></Link>
          </div>
        )}
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #fdf8f3 0%, #f7efe6 100%)" }}>
      <Navbar />{children}
    </div>
  );
}

// ─── Inline photo upload tile (no separate panel needed) ────────────────────
function PhotoUploadTile({ count, tripId, onUploaded }: { count: number; tripId: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);
  const remaining = MAX_PHOTOS - count;

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setTotal(selected.length);
    setCurrent(0);
    for (let i = 0; i < selected.length; i++) {
      setCurrent(i + 1);
      try { await uploadPhoto(selected[i], tripId); } catch (e) { console.error(e); }
    }
    setUploading(false);
    setDone(true);
    setTimeout(() => { setDone(false); setCurrent(0); setTotal(0); onUploaded(); }, 900);
  }

  const tileBase: React.CSSProperties = {
    height: "176px",
    border: "1.5px dashed #c4a882",
    background: "rgba(250,244,234,0.55)",
  };

  if (remaining <= 0) {
    return (
      <div className="rounded-xl flex flex-col items-center justify-center gap-1" style={tileBase}>
        <span className="font-[family-name:var(--font-caveat)] text-xs text-center px-2" style={{ color: "#c4a882" }}>Photo limit reached</span>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl flex flex-col items-center justify-center gap-1" style={tileBase}>
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#5a7a40" }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="font-[family-name:var(--font-caveat)] text-xs" style={{ color: "#5a7a40" }}>{total} saved!</span>
      </div>
    );
  }

  if (uploading) {
    const pct = total > 0 ? (current / total) * 100 : 0;
    return (
      <div className="rounded-xl flex flex-col items-center justify-center gap-2 px-3" style={tileBase}>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,94,60,0.15)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#8b5e3c" }} />
        </div>
        <span className="font-[family-name:var(--font-caveat)] text-xs" style={{ color: "#8b5e3c" }}>
          {current}/{total} uploading…
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={() => inputRef.current?.click()}
      className="rounded-xl flex flex-col items-center justify-center gap-1 transition-all hover:opacity-80"
      style={tileBase}>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)} />
      <CameraDoodle color="#b09880" size={20} />
      <span className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: "#b09880" }}>Add photo</span>
      <span className="font-[family-name:var(--font-caveat)] text-xs" style={{ color: "#c4a882" }}>
        {remaining} slot{remaining !== 1 ? "s" : ""} left
      </span>
    </button>
  );
}

// ─── Generic upload tile (voice / notes) ────────────────────────────────────
function UploadTile({ active, type, onClick }: {
  active: boolean;
  type: "voice" | "notes";
  onClick: () => void;
}) {
  const cfg = {
    voice:  { label: "Voice note",  Icon: MicDoodle },
    notes:  { label: "Write note",  Icon: NotePenDoodle },
  }[type];
  const iconColor = active ? "#8b5e3c" : "#b09880";
  return (
    <button
      onClick={onClick}
      className="rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all"
      style={{
        height: "80px",
        border: active ? "1.5px solid #8b5e3c" : "1.5px dashed #c4a882",
        background: active ? "rgba(139,94,60,0.09)" : "rgba(250,244,234,0.55)",
      }}>
      <cfg.Icon color={iconColor} size={20} />
      <span className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: iconColor }}>{cfg.label}</span>
    </button>
  );
}

function HubCard({ active, onClick, icon, label, sub, disabled }: {
  active: boolean; onClick: () => void; icon: string; label: string; sub: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl px-4 py-3 text-left transition-all border flex items-center gap-3"
      style={{
        background: active ? "rgba(139,94,60,0.12)" : disabled ? "rgba(240,235,228,0.5)" : "rgba(250,244,234,0.9)",
        borderColor: active ? "#8b5e3c" : disabled ? "rgba(180,160,130,0.3)" : "rgba(139,94,60,0.18)",
        borderWidth: active ? "1.5px" : "1px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(139,94,60,0.15)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight" style={{ fontFamily: "var(--font-playfair)", color: active ? "#3a2510" : disabled ? "#c4a882" : "#1a1008" }}>{label}</p>
        <p className="font-[family-name:var(--font-caveat)] text-sm truncate" style={{ color: active ? "#8b5e3c" : "#9a8070" }}>{sub}</p>
      </div>
    </button>
  );
}
