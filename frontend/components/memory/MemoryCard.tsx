"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Memory, api } from "@/lib/api";

const NOTE_LIMIT = 200;

function formatMemoryDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function MemoryCard({ memory, onDeleted }: { memory: Memory; onDeleted?: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = memory.ai_metadata as Record<string, string> | undefined;

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setLightbox(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  async function handleDelete() {
    if (!confirm("Delete this memory?")) return;
    setDeleting(true);
    try {
      await api.memories.delete(memory.id);
      onDeleted?.();
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  }

  const deleteBtn = (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600/80"
      title="Delete"
    >
      {deleting ? "…" : "✕"}
    </button>
  );

  if (memory.type === "photo") {
    return (
      <>
        {lightbox && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors text-lg"
              onClick={() => setLightbox(false)}
            >
              ✕
            </button>
            <img
              src={memory.file_url!}
              alt={meta?.description ?? "photo"}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
        <div className="rounded-xl overflow-hidden group relative"
          style={{ border: "1px solid rgba(139,94,60,0.14)", background: "rgba(250,244,234,0.8)" }}>
          <img
            src={memory.file_url!}
            alt={meta?.description ?? "photo"}
            className="w-full h-44 object-cover cursor-zoom-in transition-transform duration-300 hover:scale-105"
            onClick={() => setLightbox(true)}
          />
          {deleteBtn}
        </div>
      </>
    );
  }

  if (memory.type === "voice") {
    return (
      <div className="rounded-xl p-4 space-y-3 group relative"
        style={{ border: "1px solid rgba(139,94,60,0.14)", background: "rgba(250,244,234,0.8)" }}>
        {memory.file_url && <MiniAudioPlayer src={memory.file_url} />}
        {memory.content && (() => {
          const cleaned = cleanVoiceContent(memory.content);
          return (
            <div>
              <p className="font-[family-name:var(--font-caveat)] text-base leading-snug" style={{ color: "#5a3a18" }}>
                {expanded || cleaned.length <= NOTE_LIMIT ? cleaned : cleaned.slice(0, NOTE_LIMIT).trimEnd() + "…"}
              </p>
              {cleaned.length > NOTE_LIMIT && (
                <button onClick={() => setExpanded(v => !v)}
                  className="font-[family-name:var(--font-caveat)] text-sm mt-1 transition-opacity hover:opacity-70"
                  style={{ color: "#8b5e3c" }}>
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          );
        })()}
        <span className="block font-[family-name:var(--font-caveat)] text-xs" style={{ color: "#9a8070" }}>
          {formatMemoryDate(memory.created_at)}
        </span>
        {deleteBtn}
      </div>
    );
  }

  // Note
  const content = memory.content ?? "";
  const long = content.length > NOTE_LIMIT;
  return (
    <div className="rounded-xl p-4 space-y-2 group relative"
      style={{ border: "1px solid rgba(139,94,60,0.14)", background: "rgba(250,244,234,0.8)" }}>
      <p className="font-[family-name:var(--font-caveat)] text-base leading-snug" style={{ color: "#3a2510" }}>
        {expanded || !long ? content : content.slice(0, NOTE_LIMIT).trimEnd() + "…"}
      </p>
      {long && (
        <button onClick={() => setExpanded(v => !v)}
          className="font-[family-name:var(--font-caveat)] text-sm transition-opacity hover:opacity-70"
          style={{ color: "#8b5e3c" }}>
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
      <span className="block font-[family-name:var(--font-caveat)] text-xs" style={{ color: "#9a8070" }}>
        {formatMemoryDate(memory.created_at)}
      </span>
      {deleteBtn}
    </div>
  );
}

/** Strip "Narrator:", "Speaker 1:", "[Speaker]:" etc. from Whisper output */
function cleanVoiceContent(text: string): string {
  return text
    .replace(/^\s*\[?(narrator|speaker\s*\d*|unknown\s*speaker)\]?\s*[:.：]?\s*/i, "")
    .trim();
}

// ─── Mini audio player ────────────────────────────────────────────────────────
function MiniAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isDragging = useRef(false);

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
      style={{ background: "rgba(139,94,60,0.07)", border: "1px solid rgba(139,94,60,0.15)" }}>
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
        style={{ background: "#8b5e3c", color: "#fff" }}>
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
        {/* Taller hit area so it's easy to tap/drag */}
        <div ref={trackRef}
          className="w-full flex items-center cursor-pointer select-none touch-none"
          style={{ height: 24 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}>
          <div className="w-full h-2 rounded-full relative" style={{ background: "rgba(139,94,60,0.15)" }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: "#8b5e3c" }} />
            {/* Thumb dot */}
            <div className="absolute top-1/2 w-3.5 h-3.5 rounded-full shadow-sm"
              style={{ left: `${progress * 100}%`, transform: "translate(-50%, -50%)", background: "#8b5e3c" }} />
          </div>
        </div>
        <div className="flex justify-between">
          <span style={{ fontSize: "10px", fontFamily: "var(--font-caveat)", color: "#8b5e3c" }}>{fmt(currentTime)}</span>
          {duration > 0 && isFinite(duration) && <span style={{ fontSize: "10px", fontFamily: "var(--font-caveat)", color: "#8b5e3c", opacity: 0.55 }}>{fmt(duration)}</span>}
        </div>
      </div>
    </div>
  );
}

function VoiceWaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
      <rect x="7" y="1" width="2" height="10" rx="1" fill="#8b5e3c" />
      <rect x="3.5" y="3.5" width="2" height="5" rx="1" fill="#8b5e3c" opacity="0.6" />
      <rect x="10.5" y="3.5" width="2" height="5" rx="1" fill="#8b5e3c" opacity="0.6" />
      <rect x="0" y="5.5" width="2" height="3" rx="1" fill="#8b5e3c" opacity="0.35" />
      <rect x="14" y="5.5" width="2" height="3" rx="1" fill="#8b5e3c" opacity="0.35" />
    </svg>
  );
}

function NoteLineIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ opacity: 0.6 }}>
      <line x1="2" y1="4" x2="13" y2="4" stroke="#8b5e3c" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="2" y1="7.5" x2="13" y2="7.5" stroke="#8b5e3c" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="2" y1="11" x2="9" y2="11" stroke="#8b5e3c" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
