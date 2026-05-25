"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/shared/Navbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, Trip } from "@/lib/api";
import PhotoUpload from "@/components/upload/PhotoUpload";
import VoiceRecorder from "@/components/upload/VoiceRecorder";
import NoteEditor from "@/components/upload/NoteEditor";
import { supabase } from "@/lib/supabase";
import { WaveGreeting, JournalDoodle } from "@/components/trip/HanddrawnDecorations";
import MemoiraLoader from "@/components/shared/MemoiraLoader";

const HOME_THEMES = [
  { key: "earthy",    label: "Earthy",  icon: "🌱", bg: "linear-gradient(160deg, #ddebd0 0%, #f0ead8 50%, #dce8f0 100%)", accent: "#5a7a40", text: "#2e3e20", sub: "#6a7e5a" },
  { key: "vintage",   label: "Vintage", icon: "📷", bg: "linear-gradient(160deg, #f5e8c0 0%, #e8d498 50%, #d4bc78 100%)", accent: "#8a5a20", text: "#2a1a08", sub: "#7a5a30" },
  { key: "handdrawn", label: "Paper",   icon: "✏️", bg: "linear-gradient(160deg, #f8f0df 0%, #f0e6ce 50%, #e0ccaa 100%)", accent: "#8b5e3c", text: "#1a1008", sub: "#7a6040" },
] as const;

type HomeThemeKey = typeof HOME_THEMES[number]["key"];

function getLatestMemoryDate(trip: Trip): string {
  const mems = trip.memories ?? [];
  if (mems.length === 0) return trip.created_at;
  return [...mems].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].created_at;
}

function formatTripDate(start: string, end: string | null | undefined): string {
  const parse = (d: string) => new Date(d + "T12:00:00");
  const fmt = (d: Date, showYear: boolean) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) });
  if (!end || end === start) return fmt(parse(start), true);
  const s = parse(start), e = parse(end);
  return s.getFullYear() === e.getFullYear()
    ? `${fmt(s, false)} – ${fmt(e, true)}`
    : `${fmt(s, true)} – ${fmt(e, true)}`;
}

export default function HomePage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", single_day: false });
  const [captureOpen, setCaptureOpen] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string>("");
  const [homeTheme, setHomeTheme] = useState<HomeThemeKey>("earthy");
  const [profileOpen, setProfileOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [dobInput, setDobInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const [sendingPasswordLink, setSendingPasswordLink] = useState(false);
  const [search, setSearch] = useState("");
  const [splashPhase, setSplashPhase] = useState<"show" | "fade" | "done">("show");
  const [avatarUrl, setAvatarUrl] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function loadTrips() {
    return api.trips.list().then(data => { setTrips(data); return data; }).catch(() => []);
  }

  useEffect(() => {
    // Splash timers
    const t1 = setTimeout(() => setSplashPhase("fade"), 1400);
    const t2 = setTimeout(() => setSplashPhase("done"), 1900);

    // Migrate old "ghibli" key to "earthy"
    const saved = localStorage.getItem("memoiraaa_home_theme") as string | null;
    const migratedKey = saved === "ghibli" ? "earthy" : saved;
    if (migratedKey && HOME_THEMES.find(t => t.key === migratedKey)) setHomeTheme(migratedKey as HomeThemeKey);

    const savedName = localStorage.getItem("memoiraaa_user_name") ?? "";
    const savedDob  = localStorage.getItem("memoiraaa_dob") ?? "";
    const savedEmail = localStorage.getItem("memoiraaa_email") ?? "";
    const savedAvatar = localStorage.getItem("memoiraaa_avatar") ?? "";
    setDisplayName(savedName);
    setNameInput(savedName);
    setDobInput(savedDob);
    setEmailInput(savedEmail);
    setAvatarUrl(savedAvatar);
    loadTrips().finally(() => setLoading(false));
    supabase.auth.getUser().then(({ data }) => { if (data.user?.email) setAuthEmail(data.user.email); });

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Reload trips when page is restored from iOS bfcache (back/forward navigation)
  useEffect(() => {
    function handlePageShow(e: PageTransitionEvent) {
      if (e.persisted) loadTrips();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Scroll to top when dialog opens so iOS keyboard doesn't push it off-screen
  useEffect(() => {
    if (open) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [open]);

  function switchHomeTheme(key: HomeThemeKey) {
    setHomeTheme(key);
    localStorage.setItem("memoiraaa_home_theme", key);
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement("canvas");
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      // Crop to square from center
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, 128, 128);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      localStorage.setItem("memoiraaa_avatar", dataUrl);
      setAvatarUrl(dataUrl);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function handleSaveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const name  = nameInput.trim();
      const email = emailInput.trim();
      if (name)  { localStorage.setItem("memoiraaa_user_name", name); setDisplayName(name); }
      if (dobInput) localStorage.setItem("memoiraaa_dob", dobInput);
      if (email) localStorage.setItem("memoiraaa_email", email);
      await supabase.auth.updateUser({
        data: { display_name: name || undefined, date_of_birth: dobInput || undefined },
        ...(email ? { email } : {}),
      });
      setProfileOpen(false);
    } catch (e) { console.error(e); }
    setSavingProfile(false);
  }

  async function handleSendPasswordLink() {
    if (!authEmail || sendingPasswordLink) return;
    setSendingPasswordLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setSendingPasswordLink(false);
    if (!error) setPasswordLinkSent(true);
  }

  const sortedTrips = [...trips].sort((a, b) =>
    getLatestMemoryDate(b).localeCompare(getLatestMemoryDate(a))
  );
  const filteredTrips = search.trim()
    ? sortedTrips.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : sortedTrips;
  const captureJournals = sortedTrips.filter(t => t.status === "draft" || t.status === "reconstructing");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const payload: { name: string; start_date?: string; end_date?: string } = { name: form.name };
      if (form.start_date) {
        payload.start_date = form.start_date;
        payload.end_date = form.single_day ? form.start_date : (form.end_date || form.start_date);
      } else if (!form.start_date && !form.end_date) {
        // No dates: use today as a fallback
        payload.start_date = today;
        payload.end_date = today;
      }
      const trip = await api.trips.create(payload);
      setOpen(false);
      setForm({ name: "", start_date: "", end_date: "", single_day: false });
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      router.push(`/trips/${trip.id}`);
    } catch { setCreating(false); }
  }

  function handleCaptureOpen() {
    if (captureJournals.length > 0 && !selectedJournalId) setSelectedJournalId(captureJournals[0].id);
    setCaptureOpen(true);
  }

  const selectedJournal = captureJournals.find(t => t.id === selectedJournalId);
  const selectedPhotoCount = (selectedJournal?.memories ?? []).filter(m => m.type === "photo").length;
  const currentTheme = HOME_THEMES.find(t => t.key === homeTheme) ?? HOME_THEMES[0];

  return (
    <div className="min-h-screen" style={{ background: currentTheme.bg }}>
      {/* Splash screen — paper themed */}
      {splashPhase !== "done" && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
          style={{
            background: "linear-gradient(160deg, #f8f0df 0%, #f0e6ce 50%, #e8dcc8 100%)",
            opacity: splashPhase === "fade" ? 0 : 1,
            transition: "opacity 0.5s ease",
          }}>
          {/* Paper ruled lines */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(120,80,40,0.045) 27px, rgba(120,80,40,0.045) 28px)", pointerEvents: "none" }} />

          {/* Top-left paper corner doodle */}
          <div style={{ position: "absolute", top: 24, left: 24, opacity: 0.28 }}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="4" y="4" width="56" height="56" rx="3" stroke="#8b5e3c" strokeWidth="1.2"/>
              <path d="M42 4 L60 22 L42 22 Z" fill="#8b5e3c" fillOpacity="0.15" stroke="#8b5e3c" strokeWidth="1"/>
              <line x1="12" y1="30" x2="38" y2="30" stroke="#8b5e3c" strokeWidth="1" strokeLinecap="round"/>
              <line x1="12" y1="38" x2="32" y2="38" stroke="#8b5e3c" strokeWidth="1" strokeLinecap="round"/>
              <line x1="12" y1="46" x2="26" y2="46" stroke="#8b5e3c" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Bottom-right star + dots doodle */}
          <div style={{ position: "absolute", bottom: 32, right: 32, opacity: 0.25 }}>
            <svg width="90" height="60" viewBox="0 0 90 60" fill="none">
              <circle cx="10" cy="30" r="3.5" fill="#8b5e3c"/>
              <circle cx="45" cy="10" r="2.5" fill="#8b5e3c"/>
              <circle cx="78" cy="38" r="4.5" fill="#8b5e3c"/>
              <path d="M28 32 L30 26 L32 32 L38 32 L33 36 L35 42 L30 38 L25 42 L27 36 L22 32 Z" stroke="#8b5e3c" strokeWidth="1.1" fill="none" strokeLinejoin="round"/>
              <circle cx="60" cy="22" r="1.5" fill="#8b5e3c" opacity="0.6"/>
              <circle cx="18" cy="50" r="2" fill="#8b5e3c" opacity="0.5"/>
            </svg>
          </div>

          {/* Top-right small quill doodle */}
          <div style={{ position: "absolute", top: 28, right: 28, opacity: 0.2 }}>
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none">
              <path d="M38 2 C30 4 10 18 8 48" stroke="#8b5e3c" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M38 2 C28 8 20 6 8 48 C20 30 34 18 38 2Z" stroke="#8b5e3c" strokeWidth="1.1" fill="none"/>
              <path d="M8 48 L6 44 M8 48 L12 44" stroke="#8b5e3c" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="text-center space-y-2 relative">
            <h1 style={{ fontFamily: "var(--font-caveat)", fontSize: "5rem", color: "#3a2510", fontWeight: 700, lineHeight: 1 }}>
              memoira
            </h1>
            <p style={{ fontFamily: "var(--font-caveat)", fontSize: "1.25rem", color: "#7a5a30", opacity: 0.78 }}>
              your memories, beautifully preserved.
            </p>
            <MemoiraLoader message="" />
          </div>
        </div>
      )}

      <Navbar />

      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.32)", borderBottom: "1px solid rgba(255,255,255,0.5)", backdropFilter: "blur(10px)" }}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: currentTheme.text }}>
                Your journals
              </h1>
              {displayName && (
                <p className="font-[family-name:var(--font-caveat)] text-2xl" style={{ color: currentTheme.sub }}>
                  Welcome back, {displayName} <WaveGreeting color={currentTheme.sub} size={24} />
                </p>
              )}
              {!displayName && (
                <p className="font-[family-name:var(--font-caveat)] text-2xl" style={{ color: currentTheme.sub }}>
                  every road taken, every moment kept.
                </p>
              )}
            </div>

            {/* Right column: buttons only */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Book doodle — app info trigger */}
              <button
                onClick={() => setAboutOpen(true)}
                title="What is Memoira?"
                className="flex items-center justify-center transition-opacity hover:opacity-60 shrink-0"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                <svg width="22" height="26" viewBox="0 0 34 40" fill="none" style={{ opacity: 0.45 }}>
                  <rect x="6" y="2" width="24" height="36" rx="2.5" stroke={currentTheme.accent} strokeWidth="1.5" fill="none"/>
                  <rect x="6" y="2" width="5" height="36" rx="1.5" fill={currentTheme.accent} fillOpacity="0.15" stroke={currentTheme.accent} strokeWidth="1.5"/>
                  <line x1="14" y1="11" x2="26" y2="11" stroke={currentTheme.accent} strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>
                  <line x1="14" y1="16" x2="26" y2="16" stroke={currentTheme.accent} strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>
                  <line x1="14" y1="21" x2="22" y2="21" stroke={currentTheme.accent} strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>
                  <path d="M21 2 L21 10 L23.5 7.5 L26 10 L26 2" fill={currentTheme.accent} fillOpacity="0.4" stroke={currentTheme.accent} strokeWidth="1.1" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* New Memory */}
              <Dialog open={open} onOpenChange={setOpen}>
                <button
                  onClick={() => setOpen(true)}
                  title="New memory"
                  className="font-[family-name:var(--font-caveat)] text-lg rounded-xl whitespace-nowrap transition-opacity hover:opacity-90 flex items-center justify-center"
                  style={{ background: currentTheme.accent, color: "#fff" }}>
                  <span className="sm:hidden w-9 h-9 grid place-items-center font-sans text-xl font-light">+</span>
                  <span className="hidden sm:block px-4 py-2">+ New memory</span>
                </button>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "var(--font-playfair)" }}>Start a new memory</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 mt-2">
                        <div className="space-y-1.5 min-w-0">
                        <Label htmlFor="name" className="font-[family-name:var(--font-caveat)] text-lg">Journal name</Label>
                        <input
                          id="name"
                          placeholder="Bombay Diaries"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          required
                            className="w-full min-w-0 max-w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-lg"
                          style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008" }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="single-day"
                          checked={form.single_day}
                          onChange={e => setForm({ ...form, single_day: e.target.checked, end_date: e.target.checked ? form.start_date : form.end_date })}
                          className="rounded"
                          style={{ accentColor: currentTheme.accent }}
                        />
                        <Label htmlFor="single-day" className="font-[family-name:var(--font-caveat)] text-lg cursor-pointer" style={{ color: "#3a2510" }}>
                          Single-day journal
                        </Label>
                      </div>
                      <div className={form.single_day ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
                        <div className="space-y-1.5 min-w-0">
                          <Label htmlFor="start" className="font-[family-name:var(--font-caveat)] text-base">
                            {form.single_day ? "Date" : "Start date"} <span className="opacity-50">(optional)</span>
                          </Label>
                          <input
                            id="start"
                            type="date"
                            value={form.start_date}
                            onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.single_day ? e.target.value : form.end_date })}
                            className="w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-base"
                            style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008", WebkitAppearance: "none" }}
                          />
                        </div>
                        {!form.single_day && (
                          <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="end" className="font-[family-name:var(--font-caveat)] text-base">End date <span className="opacity-50">(optional)</span></Label>
                            <input
                              id="end"
                              type="date"
                              value={form.end_date}
                              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                              className="w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-base"
                              style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008", WebkitAppearance: "none" }}
                            />
                          </div>
                        )}
                      </div>
                      <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#9a8070" }}>
                        Skip dates and we&apos;ll use today&apos;s date. AI also auto-detects from photo EXIF.
                      </p>
                      <button type="submit" disabled={creating}
                        className="w-full font-[family-name:var(--font-caveat)] text-xl py-3 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50"
                        style={{ background: currentTheme.accent, color: "#fff" }}>
                        {creating ? "Starting…" : "Start journal"}
                      </button>
                    </form>
                  </DialogContent>
                </Dialog>

              {/* Profile avatar */}
              <button
                onClick={() => { setNameInput(displayName); setProfileOpen(true); }}
                title="Edit profile"
                className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold transition-opacity hover:opacity-80 shrink-0"
                style={{ background: currentTheme.accent, color: "#fff", fontFamily: "var(--font-caveat)", fontSize: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : (displayName ? displayName[0].toUpperCase() : "✎")}
              </button>
            </div>
          </div>

          {/* Search — significantly below welcome text */}
          <div className="relative mt-14 w-full sm:w-64">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-35" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke={currentTheme.sub} strokeWidth="1.4"/>
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={currentTheme.sub} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search journals…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl outline-none font-[family-name:var(--font-caveat)] text-lg"
              style={{
                background: "rgba(255,255,255,0.45)",
                border: `1px solid rgba(255,255,255,0.6)`,
                color: currentTheme.text,
                backdropFilter: "blur(8px)",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition-opacity text-xs" style={{ color: currentTheme.sub }}>
                ✕
              </button>
            )}
          </div>

        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 pt-4 pb-10">
        {/* Journal count + theme — close to the tile grid */}
        <div className="flex items-center justify-between mb-4">
          <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: currentTheme.sub, opacity: sortedTrips.length > 0 ? 0.65 : 0 }}>
            {sortedTrips.length} journal{sortedTrips.length !== 1 ? "s" : ""}
          </p>
          <HomeThemeDropdown value={homeTheme} onChange={switchHomeTheme} currentTheme={currentTheme} />
        </div>

        {loading ? (
          <MemoiraLoader message="Loading your journals" />
        ) : filteredTrips.length === 0 && search ? (
          <p className="font-[family-name:var(--font-caveat)] text-xl text-center py-12" style={{ color: currentTheme.sub }}>
            No journals matching &quot;{search}&quot;
          </p>
        ) : sortedTrips.length === 0 ? (
          <EmptyState onNew={() => setOpen(true)} accent={currentTheme.accent} text={currentTheme.text} sub={currentTheme.sub} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredTrips.map((trip) => <JournalCard key={trip.id} trip={trip} accent={currentTheme.accent} />)}
          </div>
        )}
      </main>

      {/* Profile edit modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair)" }}>Your profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Avatar upload */}
            <div className="flex justify-center">
              <div className="relative cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div
                  className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold transition-opacity hover:opacity-80"
                  style={{ background: currentTheme.accent, color: "#fff", fontFamily: "var(--font-caveat)" }}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : (displayName ? displayName[0].toUpperCase() : "✎")}
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); avatarInputRef.current?.click(); }}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-opacity hover:opacity-80"
                  style={{ background: "#fff", border: `2.5px solid ${currentTheme.accent}`, color: currentTheme.accent, boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }}>
                  +
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                  onChange={handleAvatarUpload} />
              </div>
            </div>

                          <div className="space-y-1.5 min-w-0">
              <Label htmlFor="display-name" className="font-[family-name:var(--font-caveat)] text-lg">Display name</Label>
              <input
                id="display-name"
                placeholder="Your name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                              className="w-full min-w-0 max-w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-lg"
                style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob" className="font-[family-name:var(--font-caveat)] text-lg">Date of birth <span className="opacity-50 text-base">(optional)</span></Label>
              <input
                id="dob"
                type="date"
                value={dobInput}
                onChange={e => setDobInput(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-base"
                style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008", WebkitAppearance: "none" }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-[family-name:var(--font-caveat)] text-lg">Email <span className="opacity-50 text-base">(for sync)</span></Label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full min-w-0 max-w-full rounded-xl px-3 py-2.5 outline-none font-[family-name:var(--font-caveat)] text-lg"
                style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.7)", color: "#1a1008" }}
              />
              <p className="font-[family-name:var(--font-caveat)] text-sm opacity-60" style={{ color: "#9a8070" }}>
                Changing email sends a confirmation link to both addresses.
              </p>
            </div>

            {/* Change password — sends a recovery link so email identity is properly created */}
            <div className="rounded-xl px-3 py-3 space-y-2" style={{ background: "rgba(139,94,60,0.05)", border: "1px solid rgba(139,94,60,0.12)" }}>
              {!passwordLinkSent ? (
                <>
                  <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#6a4828" }}>
                    Set or change your password via a secure link sent to{" "}
                    <strong>{authEmail || "your email"}</strong>.
                  </p>
                  <button
                    onClick={handleSendPasswordLink}
                    disabled={sendingPasswordLink || !authEmail}
                    className="font-[family-name:var(--font-caveat)] text-base underline underline-offset-2 transition-opacity hover:opacity-60 disabled:opacity-40"
                    style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer", padding: 0 }}>
                    {sendingPasswordLink ? "Sending…" : "Send password setup link →"}
                  </button>
                </>
              ) : (
                <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#5a7a40" }}>
                  Link sent to <strong>{authEmail}</strong>. Check your inbox and click it to set your password.
                </p>
              )}
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="w-full font-[family-name:var(--font-caveat)] text-xl py-3 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: currentTheme.accent, color: "#fff" }}>
              {savingProfile ? "Saving…" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-capture modal */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair)" }}>Add a memory</DialogTitle>
          </DialogHeader>
          {captureJournals.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#9a8070" }}>Start a journal first to add memories.</p>
              <button onClick={() => { setCaptureOpen(false); setOpen(true); }}
                className="font-[family-name:var(--font-caveat)] text-lg px-5 py-2.5 rounded-xl transition-opacity hover:opacity-85"
                style={{ background: currentTheme.accent, color: "#fff" }}>
                + Start a journal
              </button>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="journal-picker" className="font-[family-name:var(--font-caveat)] text-lg">Journal</Label>
                <select id="journal-picker"
                  className="w-full rounded-xl border px-3 py-2.5 font-[family-name:var(--font-caveat)] text-lg"
                  style={{ borderColor: "rgba(139,94,60,0.25)", background: "rgba(250,244,234,0.8)", color: "#3a2510" }}
                  value={selectedJournalId}
                  onChange={(e) => setSelectedJournalId(e.target.value)}>
                  {captureJournals.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              {selectedJournalId && (
                <Tabs defaultValue="photos">
                  <TabsList>
                    <TabsTrigger value="photos" className="font-[family-name:var(--font-caveat)]">Photos</TabsTrigger>
                    <TabsTrigger value="voice" className="font-[family-name:var(--font-caveat)]">Voice</TabsTrigger>
                    <TabsTrigger value="note" className="font-[family-name:var(--font-caveat)]">Note</TabsTrigger>
                  </TabsList>
                  <TabsContent value="photos">
                    <PhotoUpload tripId={selectedJournalId} count={selectedPhotoCount} onUploaded={() => { setCaptureOpen(false); loadTrips(); }} />
                  </TabsContent>
                  <TabsContent value="voice">
                    <VoiceRecorder tripId={selectedJournalId} onUploaded={() => { setCaptureOpen(false); loadTrips(); }} />
                  </TabsContent>
                  <TabsContent value="note">
                    <NoteEditor tripId={selectedJournalId} onUploaded={() => { setCaptureOpen(false); loadTrips(); }} />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              {[
                { text: "Upload photos from your travels and daily life", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.3"/><circle cx="12" cy="13" r="1.3" fill="currentColor" opacity="0.35"/><path d="M8 6 L9.5 3 L14.5 3 L16 6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/><circle cx="18.5" cy="9" r="1" fill="currentColor" opacity="0.45"/></svg> },
                { text: "Record voice notes to save your thoughts in the moment", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="2" width="8" height="11" rx="4" stroke="currentColor" strokeWidth="1.4"/><path d="M4 11 C4 15.4 7.6 18.5 12 18.5 C16.4 18.5 20 15.4 20 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/><line x1="12" y1="18.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="9" y1="21.5" x2="15" y2="21.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
                { text: "Write journal entries, reflections, and stories", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4 L16.5 4 L20 7.5 L20 20 L4 20 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><path d="M16.5 4 L16.5 7.5 L20 7.5" stroke="currentColor" strokeWidth="1.4" fill="none"/><line x1="7" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/><line x1="7" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/><line x1="7" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/></svg> },
                { text: "Let AI weave everything into a beautiful scrapbook", svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 5 C2 5 6 4 12 4 C18 4 22 5 22 5 L22 20 C22 20 18 19 12 19 C6 19 2 20 2 20 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="12" y1="4" x2="12" y2="19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/><line x1="5" y1="8" x2="11" y2="7.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/><line x1="5" y1="11" x2="11" y2="10.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/><line x1="13" y1="7.5" x2="19" y2="8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/><line x1="13" y1="10.5" x2="19" y2="11" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5"/></svg> },
              ].map(({ svg, text }) => (
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
    </div>
  );
}

function JournalCard({ trip, accent }: { trip: Trip; accent: string }) {
  const photos = (trip.memories ?? []).filter(m => m.type === "photo" && m.file_url);
  const hasPhotos = photos.length > 0;
  const isReady = trip.status === "ready";
  const isReconstructing = trip.status === "reconstructing";
  const href = isReady ? `/trips/${trip.id}/scrapbook` : `/trips/${trip.id}`;

  // Badge: "book" when photos exist (or ready), "organizing" when processing, nothing otherwise
  const badgeLabel: string | null = isReconstructing
    ? "organizing"
    : hasPhotos
    ? "book"
    : null;

  const dateRange = trip.start_date ? formatTripDate(trip.start_date, trip.end_date) : "";

  return (
    <Link href={href}>
      <div className="group rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
        style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
        {/* Square image area */}
        <div className="relative overflow-hidden" style={{ paddingBottom: "100%", background: "linear-gradient(135deg, #c8d8b8 0%, #d8cca8 100%)" }}>
          <div className="absolute inset-0">
            {photos.length === 0 && trip.cover_image_url && (
              <img src={trip.cover_image_url} alt={trip.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            )}
            {photos.length === 0 && !trip.cover_image_url && (
              <div className="w-full h-full flex items-center justify-center">
                <JournalDoodle size={56} />
              </div>
            )}
            {photos.length === 1 && (
              <img src={photos[0].file_url!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            )}
            {photos.length === 2 && (
              <div className="grid grid-cols-2 h-full gap-0.5">
                {photos.map(p => <img key={p.id} src={p.file_url!} alt="" className="w-full h-full object-cover" />)}
              </div>
            )}
            {photos.length >= 3 && (
              <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
                <img src={photos[0].file_url!} alt="" className="row-span-2 w-full h-full object-cover" />
                <img src={photos[1].file_url!} alt="" className="w-full h-full object-cover" />
                <div className="relative">
                  <img src={photos[2].file_url!} alt="" className="w-full h-full object-cover" />
                  {photos.length > 3 && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.42)" }}>
                      <span className="font-[family-name:var(--font-caveat)] text-white text-xl font-bold">+{photos.length - 3}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Status badge — only when meaningful, top-right */}
          {badgeLabel && (
            <div className="absolute top-2 right-2">
              <span className="font-[family-name:var(--font-caveat)] text-base px-2.5 py-1 rounded-full"
                style={{
                  background: isReady || hasPhotos ? `${accent}dd` : "rgba(255,255,255,0.8)",
                  color: isReady || hasPhotos ? "#fff" : "#5a6e4a",
                }}>
                {badgeLabel}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-3 py-3 space-y-1">
          <h3 className="font-bold text-lg leading-tight truncate" style={{ fontFamily: "var(--font-playfair)", color: "#2e3e20" }}>
            {trip.name}
          </h3>
          {dateRange && (
            <p className="font-[family-name:var(--font-caveat)] text-base truncate" style={{ color: "#8a9e7a" }}>{dateRange}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ onNew, accent, text, sub }: { onNew: () => void; accent: string; text: string; sub: string }) {
  return (
    <div className="text-center py-6 space-y-5">
      <div className="flex justify-center">
        <JournalDoodle size={64} color={sub} />
      </div>
      <p style={{ fontFamily: "var(--font-playfair)", fontSize: "1.8rem", color: text, fontWeight: 600 }}>
        Your first chapter is waiting.
      </p>
      <p className="font-[family-name:var(--font-caveat)] text-xl max-w-sm mx-auto" style={{ color: sub }}>
        Create a journal, upload your photos and voice notes, and let AI turn them into a scrapbook.
      </p>
      <button onClick={onNew}
        className="font-[family-name:var(--font-caveat)] text-xl px-6 py-3 rounded-xl transition-opacity hover:opacity-90"
        style={{ background: accent, color: "#fff" }}>
        + Start your first journal
      </button>
    </div>
  );
}

function HomeThemeDropdown({ value, onChange, currentTheme }: {
  value: HomeThemeKey;
  onChange: (k: HomeThemeKey) => void;
  currentTheme: typeof HOME_THEMES[number];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const selected = HOME_THEMES.find(t => t.key === value) ?? HOME_THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="font-[family-name:var(--font-caveat)] text-sm px-2.5 py-1.5 rounded-lg outline-none flex items-center gap-1.5"
        style={{
          border: `1px solid ${currentTheme.accent}40`,
          background: "rgba(255,255,255,0.45)",
          color: currentTheme.sub,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}>
        <span>{selected.icon} {selected.label}</span>
        <svg width="8" height="5" viewBox="0 0 9 5" fill="none"
          style={{ marginLeft: 2, flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path d="M1 1l3.5 3L8 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 rounded-xl overflow-hidden shadow-xl z-50"
          style={{
            background: "rgba(255,255,255,0.95)",
            border: `1px solid ${currentTheme.accent}30`,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            minWidth: 120,
          }}>
          {HOME_THEMES.map(t => (
            <button
              key={t.key}
              onClick={() => { onChange(t.key); setOpen(false); }}
              className="w-full px-3 py-2 text-left font-[family-name:var(--font-caveat)] text-sm flex items-center gap-2 transition-opacity hover:opacity-75"
              style={{
                color: t.key === value ? currentTheme.accent : currentTheme.sub,
                fontWeight: t.key === value ? 600 : 400,
                background: t.key === value ? `${currentTheme.accent}18` : "transparent",
              }}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.key === value && <span className="ml-auto text-xs opacity-70">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
