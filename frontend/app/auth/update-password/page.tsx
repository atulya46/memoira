"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Session is already established by the server-side callback route.
    // Just confirm we have an active session before showing the form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else setError("Link expired or already used. Please request a new one.");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    await supabase.auth.signOut({ scope: "global" });
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("sb-")) localStorage.removeItem(key);
    });
    window.location.href = "/login?reset=success";
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", borderRadius: 12,
    border: "1.5px solid rgba(139,94,60,0.25)",
    background: "rgba(250,244,234,0.8)", color: "#1a1008",
    padding: "10px 14px", fontSize: 16,
    fontFamily: "var(--font-caveat)", outline: "none",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #f8f0df 0%, #f0e6ce 50%, #e8dcc8 100%)" }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-bold" style={{ fontFamily: "var(--font-caveat)", color: "#3a2510" }}>
            Set new password
          </h1>
          <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#7a5a30" }}>
            Choose something you&apos;ll remember.
          </p>
        </div>

        <div className="rounded-3xl p-6 space-y-4 shadow-sm"
          style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>

          {error && (
            <p className="font-[family-name:var(--font-caveat)] text-base text-center rounded-xl px-3 py-2"
              style={{ background: "rgba(192,57,43,0.08)", color: "#c0392b" }}>
              {error}
            </p>
          )}

          {!ready && !error && (
            <p className="font-[family-name:var(--font-caveat)] text-base text-center" style={{ color: "#9a8070" }}>
              Verifying…
            </p>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input type={showPw ? "text" : "password"} placeholder="New password (min 8 chars)"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} style={{ ...inputStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                  style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer", padding: 0 }}>
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/></svg>
                  }
                </button>
              </div>
              <input type="password" placeholder="Confirm new password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                required style={inputStyle} />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ background: "#8b5e3c", color: "#fff", border: "none", fontFamily: "var(--font-caveat)", fontSize: 17, cursor: "pointer" }}>
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}

          {!ready && error && (
            <button onClick={() => router.push("/login")}
              className="w-full font-[family-name:var(--font-caveat)] text-base transition-opacity hover:opacity-70"
              style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer" }}>
              Back to sign in →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
