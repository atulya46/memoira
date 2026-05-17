"use client";
import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/storage";

const MAX_PHOTOS = 20;

interface Props {
  tripId: string;
  count: number;
  onUploaded: () => void;
}

export default function PhotoUpload({ tripId, count, onUploaded }: Props) {
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
    setTimeout(() => {
      setDone(false);
      setCurrent(0);
      setTotal(0);
      onUploaded();
    }, 800);
  }

  if (remaining <= 0) {
    return (
      <p className="font-[family-name:var(--font-caveat)] text-base text-center py-6" style={{ color: "#9a8070" }}>
        You&apos;ve reached the 20-photo limit for this trip.
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#5a7a40" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polyline points="3,9 7,13 15,5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#5a7a40" }}>
          {total} photo{total !== 1 ? "s" : ""} saved!
        </p>
      </div>
    );
  }

  if (uploading) {
    const progressPct = total > 0 ? (current / total) * 100 : 0;
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {/* Spinning camera icon */}
        <div className="relative w-10 h-10">
          <svg viewBox="0 0 40 40" fill="none" style={{ animation: "spin 1.5s linear infinite" }}>
            <circle cx="20" cy="20" r="17" stroke="rgba(139,94,60,0.2)" strokeWidth="3" fill="none"/>
            <circle cx="20" cy="20" r="17" stroke="#8b5e3c" strokeWidth="3" fill="none"
              strokeDasharray="107" strokeDashoffset={107 - (107 * progressPct) / 100}
              strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }}/>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ fontFamily: "var(--font-caveat)", color: "#8b5e3c" }}>
            {current}/{total}
          </span>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(-90deg); } to { transform: rotate(270deg); } }`}</style>
        <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#8b5e3c" }}>
          Uploading {current} of {total}…
        </p>
        {/* Progress bar */}
        <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(139,94,60,0.15)" }}>
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: "#8b5e3c", transition: "width 0.4s ease" }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full rounded-2xl py-8 text-center transition-opacity hover:opacity-80 disabled:opacity-60"
        style={{
          border: "1.5px dashed rgba(139,94,60,0.35)",
          background: "rgba(250,244,234,0.6)",
        }}
      >
        <div className="space-y-1.5">
          <p className="text-2xl">📷</p>
          <p className="font-[family-name:var(--font-caveat)] text-lg font-medium" style={{ color: "#3a2510" }}>
            Tap to add photos
          </p>
          <p className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: "#9a8070" }}>
            {remaining} slot{remaining !== 1 ? "s" : ""} remaining · auto-compressed · AI-analyzed
          </p>
        </div>
      </button>
    </div>
  );
}
