"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/shared/Navbar";
import { Button } from "@/components/ui/button";
import { api, TripWithMemories, Memory } from "@/lib/api";

const MapTimeline = dynamic(() => import("@/components/trip/MapTimeline"), { ssr: false });

export default function ReconstructPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<TripWithMemories | null>(null);
  const [places, setPlaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  async function load() {
    const data = await api.trips.get(id);
    setTrip(data);
    // Load scrapbook places for map geocoding (best effort)
    if (data.status === "ready") {
      api.trips.getScrapbook(id)
        .then(s => {
          const p = (s.ai_config as Record<string, unknown>)?.places;
          if (Array.isArray(p)) setPlaces(p as string[]);
        })
        .catch(() => {});
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleRerun() {
    setRerunning(true);
    try {
      await api.trips.reconstruct(id);
      await load();
    } catch (e) { console.error(e); }
    setRerunning(false);
  }

  async function handleGenerateScrapbook() {
    setGenerating(true);
    try {
      await api.trips.generateScrapbook(id);
      router.push(`/trips/${id}/scrapbook`);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  }

  if (loading) return <div className="min-h-screen"><Navbar /><p className="p-8 text-muted-foreground text-sm">Loading…</p></div>;
  if (!trip) return <div className="min-h-screen"><Navbar /><p className="p-8 text-muted-foreground text-sm">Trip not found.</p></div>;

  const byDay: Record<number, Memory[]> = {};
  const unassigned: Memory[] = [];
  for (const m of trip.memories) {
    if (m.day_assigned != null) {
      byDay[m.day_assigned] = byDay[m.day_assigned] ?? [];
      byDay[m.day_assigned].push(m);
    } else {
      unassigned.push(m);
    }
  }
  const sortedDays = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  const noDaysAssigned = sortedDays.length === 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</p>
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <p className="text-sm text-muted-foreground">{trip.start_date} → {trip.end_date}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/trips/${id}`)}>← Back</Button>
        </div>

        {noDaysAssigned ? (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-1">
              <p className="font-semibold">AI needs more context to group memories</p>
              <p className="text-sm text-muted-foreground">Photos without EXIF dates and notes without day mentions are hard to place.</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
              <p className="font-medium text-muted-foreground">Tips to help AI do better:</p>
              <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                <li>Add a voice note mentioning &quot;Day 1&quot;, &quot;yesterday&quot; or a specific location</li>
                <li>Add a text note like &quot;We arrived in Goa on the 3rd&quot;</li>
                <li>Upload photos that have location or date in EXIF metadata</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRerun} disabled={rerunning}>
                {rerunning ? "Grouping…" : "Re-run grouping"}
              </Button>
              <Button variant="outline" onClick={handleGenerateScrapbook} disabled={generating}>
                {generating ? "Generating…" : "Skip & generate anyway"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Leaflet map — GPS EXIF first, then geocodes scrapbook places */}
            <MapTimeline byDay={byDay} sortedDays={sortedDays} places={places} />

            {/* Connected map timeline */}
            <div className="relative">
              {/* Vertical track */}
              <div className="absolute left-7 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" />

              <div className="space-y-0">
                {sortedDays.map((day, idx) => {
                  const memories = byDay[day];
                  const date = new Date(trip.start_date);
                  date.setDate(date.getDate() + day - 1);
                  const dateLabel = date.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
                  const isLast = idx === sortedDays.length - 1;

                  return (
                    <div key={day} className="relative flex gap-5">
                      {/* Node + connector */}
                      <div className="flex flex-col items-center shrink-0 w-14">
                        <div className="w-6 h-6 rounded-full border-2 border-primary bg-background shadow-sm flex items-center justify-center mt-6 z-10">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        </div>
                        {!isLast && <div className="flex-1 w-0.5 bg-transparent" />}
                      </div>

                      {/* Day card */}
                      <div className={`flex-1 pb-8 ${isLast ? "" : ""}`}>
                        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Day {day}</span>
                              <p className="font-semibold text-base leading-tight">{dateLabel}</p>
                            </div>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {memories.length} {memories.length === 1 ? "memory" : "memories"}
                            </span>
                          </div>

                          {/* Photo strip */}
                          {memories.filter(m => m.type === "photo" && m.file_url).length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                              {memories.filter(m => m.type === "photo" && m.file_url).map((m) => (
                                <img
                                  key={m.id}
                                  src={m.file_url!}
                                  alt={(m.ai_metadata?.description as string) || ""}
                                  className="w-20 h-20 object-cover rounded-xl shrink-0"
                                />
                              ))}
                            </div>
                          )}

                          {/* Non-photo memory chips */}
                          {memories.filter(m => m.type !== "photo").length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {memories.filter(m => m.type !== "photo").map((m) => (
                                <span key={m.id} className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-1 flex items-center gap-1">
                                  {m.type === "voice" ? "🎙" : "📝"}
                                  {(m.ai_metadata?.emotional_tone as string) || m.content?.slice(0, 30) || "Memory"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Unassigned node */}
                {unassigned.length > 0 && (
                  <div className="relative flex gap-5">
                    <div className="flex flex-col items-center shrink-0 w-14">
                      <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/40 bg-background mt-6 z-10" />
                    </div>
                    <div className="flex-1 pb-8">
                      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-muted-foreground">Unplaced ({unassigned.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {unassigned.map((m) => (
                            <MiniChip key={m.id} memory={m} />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Add a voice note mentioning the day or location to help AI place these.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={handleRerun} disabled={rerunning}>
                {rerunning ? "Re-grouping…" : "Re-run grouping"}
              </Button>
              <Button onClick={handleGenerateScrapbook} disabled={generating} size="lg">
                {generating ? "Generating scrapbook…" : "Generate scrapbook →"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MiniChip({ memory }: { memory: Memory }) {
  const icon = memory.type === "photo" ? "📷" : memory.type === "voice" ? "🎙" : "📝";
  const label = (memory.ai_metadata?.description as string) || memory.content?.slice(0, 24) || "Memory";
  return (
    <span className="text-xs bg-muted rounded-full px-2.5 py-1 flex items-center gap-1 text-muted-foreground">
      {icon} {label}
    </span>
  );
}
