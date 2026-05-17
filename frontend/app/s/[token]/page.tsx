"use client";

import { use, useEffect, useMemo, useState } from "react";
import { api, Memory, SharedScrapbook } from "@/lib/api";

const REACTIONS = ["❤️", "😍", "🥹", "✨", "👏", "🔥"];

function formatTripDate(start: string, end: string): string {
  const parse = (value: string) => new Date(value + "T12:00:00");
  const fmt = (date: Date, showYear: boolean) =>
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      ...(showYear ? { year: "numeric" } : {}),
    });
  if (!end || end === start) return fmt(parse(start), true);
  const s = parse(start);
  const e = parse(end);
  return s.getFullYear() === e.getFullYear()
    ? `${fmt(s, false)} - ${fmt(e, true)}`
    : `${fmt(s, true)} - ${fmt(e, true)}`;
}

function getSessionId(): string {
  const key = "memoiraaa_shared_session";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

export default function SharedScrapbookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [scrapbook, setScrapbook] = useState<SharedScrapbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reacted, setReacted] = useState<string | null>(null);

  useEffect(() => {
    api.scrapbooks.getShared(token)
      .then(setScrapbook)
      .catch(() => setError("This shared scrapbook is unavailable."))
      .finally(() => setLoading(false));
  }, [token]);

  const memoriesByDay = useMemo(() => {
    const grouped: Record<number, Memory[]> = {};
    for (const memory of scrapbook?.memories ?? []) {
      if (memory.day_assigned == null) continue;
      grouped[memory.day_assigned] = grouped[memory.day_assigned] ?? [];
      grouped[memory.day_assigned].push(memory);
    }
    return grouped;
  }, [scrapbook]);

  async function addReaction(emoji: string) {
    try {
      await api.scrapbooks.addReaction(token, emoji, getSessionId());
      setReacted(emoji);
    } catch {
      setReacted(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7f1e8] px-4">
        <p className="font-[family-name:var(--font-caveat)] text-xl text-[#7a6040]">Opening scrapbook...</p>
      </main>
    );
  }

  if (error || !scrapbook) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f7f1e8] px-4">
        <p className="font-[family-name:var(--font-caveat)] text-xl text-[#7a6040]">{error}</p>
      </main>
    );
  }

  const ai = scrapbook.ai_config as {
    cover_tagline?: string;
    day_summaries?: Record<string, string>;
    highlights?: Record<string, string | null>;
    places?: string[];
  };
  const pages = [...scrapbook.scrapbook_pages].sort((a, b) => a.day_number - b.day_number);

  return (
    <main className="min-h-screen bg-[#f7f1e8] text-[#1a1008]">
      <section className="mx-auto max-w-4xl px-4 py-10 space-y-3">
        <p className="font-[family-name:var(--font-caveat)] text-lg text-[#7a6040]">
          {formatTripDate(scrapbook.trips.start_date, scrapbook.trips.end_date)}
        </p>
        <h1 className="font-[family-name:var(--font-caveat)] text-5xl font-bold leading-tight">
          {scrapbook.trips.name}
        </h1>
        {ai.cover_tagline && (
          <p className="font-[family-name:var(--font-caveat)] text-2xl text-[#5a3a18]">{ai.cover_tagline}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-3">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addReaction(emoji)}
              className="h-10 w-10 rounded-full bg-white/70 text-xl transition hover:bg-white"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          {reacted && (
            <span className="font-[family-name:var(--font-caveat)] text-base text-[#5a7a40] self-center">
              Thanks for the {reacted}
            </span>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 space-y-12">
        {pages.map((page) => {
          const memories = memoriesByDay[page.day_number] ?? [];
          const photos = memories.filter((memory) => memory.type === "photo" && memory.file_url);
          const voices = memories.filter((memory) => memory.type === "voice" && memory.file_url);
          const notes = memories.filter((memory) => memory.type === "note" && memory.content);
          const summary = page.ai_summary || ai.day_summaries?.[String(page.day_number)];

          return (
            <article key={page.id} className="space-y-5 border-t border-[#d8c4aa] pt-8">
              <div>
                <p className="font-[family-name:var(--font-caveat)] text-lg text-[#8b5e3c]">Day {page.day_number}</p>
                {page.location_label && (
                  <p className="font-[family-name:var(--font-caveat)] text-xl text-[#7a6040]">{page.location_label}</p>
                )}
              </div>

              {summary && (
                <p className="font-[family-name:var(--font-caveat)] text-2xl leading-relaxed text-[#3a2510]">
                  {summary}
                </p>
              )}

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.slice(0, 9).map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.file_url!}
                      alt={(photo.ai_metadata?.description as string) || "memory"}
                      className="aspect-square w-full rounded-lg object-cover shadow-sm"
                    />
                  ))}
                </div>
              )}

              {voices.length > 0 && (
                <div className="space-y-3">
                  {voices.map((voice) => (
                    <div key={voice.id} className="rounded-lg bg-white/60 p-3">
                      <audio src={voice.file_url!} controls preload="metadata" className="w-full" />
                      {voice.content && (
                        <p className="mt-2 font-[family-name:var(--font-caveat)] text-lg text-[#5a3a18]">
                          {voice.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {notes.length > 0 && (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <p key={note.id} className="rounded-lg bg-white/60 p-3 font-[family-name:var(--font-caveat)] text-xl text-[#3a2510]">
                      {note.content}
                    </p>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
