"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const INFO_ITEMS: { svg: React.ReactNode; text: string }[] = [
  {
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.3"/>
        <circle cx="12" cy="13" r="1.3" fill="currentColor" opacity="0.35"/>
        <path d="M8 6 L9.5 3 L14.5 3 L16 6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
        <circle cx="18.5" cy="9" r="1" fill="currentColor" opacity="0.45"/>
      </svg>
    ),
    text: "Upload photos from your travels and daily life",
  },
  {
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="8" y="2" width="8" height="11" rx="4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4 11 C4 15.4 7.6 18.5 12 18.5 C16.4 18.5 20 15.4 20 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        <line x1="12" y1="18.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="9" y1="21.5" x2="15" y2="21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
        <line x1="10" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
    text: "Record voice notes to save your thoughts in the moment",
  },
  {
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 4 L16.5 4 L20 7.5 L20 20 L4 20 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        <path d="M16.5 4 L16.5 7.5 L20 7.5" stroke="currentColor" strokeWidth="1.4" fill="none"/>
        <line x1="7" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
        <line x1="7" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
        <line x1="7" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
      </svg>
    ),
    text: "Write journal entries, reflections, and stories",
  },
  {
    svg: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M2 5 C2 5 6 4 12 4 C18 4 22 5 22 5 L22 20 C22 20 18 19 12 19 C6 19 2 20 2 20 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
        <line x1="12" y1="4" x2="12" y2="19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
        <line x1="5" y1="8" x2="11" y2="7.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
        <line x1="5" y1="11" x2="11" y2="10.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
        <line x1="13" y1="7.5" x2="19" y2="8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
        <line x1="13" y1="10.5" x2="19" y2="11" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/>
      </svg>
    ),
    text: "Let AI weave everything into a beautiful scrapbook",
  },
];

export default function Navbar({ transparent, textColor }: { transparent?: boolean; textColor?: string }) {
  const router = useRouter();
  const [aboutOpen, setAboutOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut({ scope: "global" });
    // Clear all Supabase session keys from localStorage to prevent auto-restore
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    });
    // Full reload forces cookies to re-evaluate — client-side push doesn't
    window.location.href = "/login";
  }

  const iconColor = textColor ?? "#6a5040";

  return (
    <>
      <nav className={`z-20 ${transparent ? "bg-transparent" : "sticky top-0 border-b border-border bg-card/80 backdrop-blur-sm"}`}>
        <div className="max-w-5xl mx-auto px-4 h-12 sm:h-14 flex items-center justify-between">
          {/* Left: logo */}
          <Link href="/" className="font-[family-name:var(--font-caveat)] text-xl sm:text-2xl font-bold tracking-wide" style={{ color: textColor }}>
            memoira
          </Link>

          {/* Right: sign out */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="font-[family-name:var(--font-caveat)] text-base sm:text-lg font-medium px-3 sm:px-4 py-1.5 rounded-lg transition-all hover:opacity-70"
              style={{ color: iconColor }}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* About modal */}
      {aboutOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
          style={{ background: "rgba(20,12,4,0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setAboutOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl"
            style={{ background: "rgba(250,244,234,0.97)", border: "1px solid rgba(139,94,60,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "1.5rem", color: "#2a1a08", fontWeight: 700, lineHeight: 1.2 }}>
                What is Memoira?
              </h2>
              <button
                onClick={() => setAboutOpen(false)}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm hover:opacity-60 transition-opacity"
                style={{ background: "rgba(139,94,60,0.12)", color: "#8b5e3c" }}>
                ✕
              </button>
            </div>
            <p className="font-[family-name:var(--font-caveat)] text-lg leading-snug" style={{ color: "#4a3018" }}>
              Memoira is your personal memory journal — a place to capture the moments that matter.
            </p>
            <ul className="space-y-3">
              {INFO_ITEMS.map(({ svg, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(139,94,60,0.08)", color: "#8b5e3c" }}>
                    {svg}
                  </span>
                  <span className="font-[family-name:var(--font-caveat)] text-base leading-snug" style={{ color: "#5a3a18" }}>{text}</span>
                </li>
              ))}
            </ul>
            <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#9a7050", opacity: 0.8 }}>
              Every memory deserves to be kept beautifully.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
