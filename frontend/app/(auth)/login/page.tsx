"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MemoiraLoader from "@/components/shared/MemoiraLoader";

type AuthMode = "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("password");
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enteringApp, setEnteringApp] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email") ?? "";
    if (emailParam) setEmail(emailParam);
    if (params.get("reset") === "success") {
      setSuccessMsg(`Password updated! Sign in with ${emailParam || "your email"} and your new password.`);
    }
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  }

  // ── Email + Password ──────────────────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (isSignUp) {
      const cleanUsername = username.trim();
      if (cleanUsername.length < 2) {
        setError("Choose a username with at least 2 characters.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username: cleanUsername,
            display_name: cleanUsername,
          },
        },
      });
      if (error) { setError(error.message); }
      else {
        localStorage.setItem("memoiraaa_user_name", cleanUsername);
        setSuccessMsg("Check your inbox to confirm your account, then sign in with your email and password.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.toLowerCase().includes("invalid")) {
          setError("Wrong email or password. Try signing up if you're new.");
        } else {
          setError(error.message);
        }
      } else {
        setEnteringApp(true);
        router.replace("/");
        router.refresh();
      }
    }
    setLoading(false);
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgotPassword() {
    if (!email) { setError("Enter your email above first."); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    if (error) setError(error.message);
    else setSuccessMsg(`Reset link sent to ${email}. Check your inbox.`);
    setLoading(false);
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setMagicSent(true);
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 12,
    border: "1.5px solid rgba(139,94,60,0.25)",
    background: "rgba(250,244,234,0.8)",
    color: "#1a1008",
    padding: "10px 14px",
    fontSize: 16,
    fontFamily: "var(--font-caveat)",
    outline: "none",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%",
    background: "#8b5e3c",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "11px 0",
    fontFamily: "var(--font-caveat)",
    fontSize: 17,
    cursor: "pointer",
    opacity: loading ? 0.6 : 1,
    transition: "opacity 0.15s",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(160deg, #f8f0df 0%, #f0e6ce 50%, #e8dcc8 100%)" }}>
      {enteringApp && <MemoiraLoader overlay message="Opening your journals" />}
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-3">
            {/* Journal doodle */}
            <svg width="34" height="40" viewBox="0 0 34 40" fill="none" style={{ opacity: 0.72, flexShrink: 0 }}>
              {/* notebook body */}
              <rect x="6" y="2" width="24" height="36" rx="2.5" stroke="#8b5e3c" strokeWidth="1.5" fill="none"/>
              {/* spine */}
              <rect x="6" y="2" width="5" height="36" rx="1.5" fill="#8b5e3c" fillOpacity="0.12" stroke="#8b5e3c" strokeWidth="1.5"/>
              {/* ruled lines */}
              <line x1="14" y1="11" x2="26" y2="11" stroke="#8b5e3c" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
              <line x1="14" y1="16" x2="26" y2="16" stroke="#8b5e3c" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
              <line x1="14" y1="21" x2="22" y2="21" stroke="#8b5e3c" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
              {/* bookmark ribbon */}
              <path d="M21 2 L21 10 L23.5 7.5 L26 10 L26 2" fill="#8b5e3c" fillOpacity="0.35" stroke="#8b5e3c" strokeWidth="1.1" strokeLinejoin="round"/>
              {/* small pen nib at bottom */}
              <path d="M13 30 L16 26 L18 28 L15 32 Z" stroke="#8b5e3c" strokeWidth="1" fill="none" strokeLinejoin="round" opacity="0.6"/>
              <line x1="13" y1="30" x2="11" y2="33" stroke="#8b5e3c" strokeWidth="1" strokeLinecap="round" opacity="0.45"/>
            </svg>
            <h1 className="text-5xl font-bold" style={{ fontFamily: "var(--font-caveat)", color: "#3a2510" }}>
              memoira
            </h1>
          </div>
          <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#7a5a30" }}>
            your memories, beautifully preserved.
          </p>
        </div>

        <div className="rounded-3xl p-6 space-y-5 shadow-sm"
          style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.7)" }}>

          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-2.5 transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ border: "1.5px solid rgba(139,94,60,0.25)", background: "rgba(255,255,255,0.9)", fontFamily: "var(--font-caveat)", fontSize: 16, color: "#1a1008", cursor: "pointer" }}>
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Connecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(139,94,60,0.15)" }} />
            <span className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: "#9a8070" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(139,94,60,0.15)" }} />
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-xl p-1" style={{ background: "rgba(139,94,60,0.08)" }}>
            <button
              onClick={() => { setMode("password"); setError(""); setSuccessMsg(""); }}
              className="flex-1 py-1.5 rounded-lg font-[family-name:var(--font-caveat)] text-base transition-all"
              style={{
                background: mode === "password" ? "rgba(255,255,255,0.9)" : "transparent",
                color: mode === "password" ? "#8b5e3c" : "#9a8070",
                fontWeight: mode === "password" ? 600 : 400,
                border: "none", cursor: "pointer",
              }}>
              Password
            </button>
            <button
              onClick={() => { setMode("magic"); setError(""); setSuccessMsg(""); setMagicSent(false); }}
              className="flex-1 py-1.5 rounded-lg font-[family-name:var(--font-caveat)] text-base transition-all"
              style={{
                background: mode === "magic" ? "rgba(255,255,255,0.9)" : "transparent",
                color: mode === "magic" ? "#8b5e3c" : "#9a8070",
                fontWeight: mode === "magic" ? 600 : 400,
                border: "none", cursor: "pointer",
              }}>
              Magic link
            </button>
          </div>

          {/* Error / success */}
          {error && (
            <p className="font-[family-name:var(--font-caveat)] text-base text-center rounded-xl px-3 py-2"
              style={{ background: "rgba(192,57,43,0.08)", color: "#c0392b" }}>
              {error}
            </p>
          )}
          {successMsg && (
            <p className="font-[family-name:var(--font-caveat)] text-base text-center rounded-xl px-3 py-2"
              style={{ background: "rgba(90,122,64,0.1)", color: "#3a6020" }}>
              {successMsg}
            </p>
          )}

          {/* Password form */}
          {mode === "password" && !successMsg && (
            <form onSubmit={handlePassword} className="space-y-3">
              {isSignUp && (
                <input type="text" placeholder="Username" value={username}
                  onChange={e => setUsername(e.target.value)} required minLength={2} style={inputStyle} />
              )}
              <input type="email" placeholder={isSignUp ? "Email" : "Email"} value={email}
                onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              <div className="relative">
                <input type={showPw ? "text" : "password"} placeholder="Password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={6} style={{ ...inputStyle, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                  style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer", padding: 0 }}>
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6"/></svg>
                  }
                </button>
              </div>
              <button type="submit" disabled={loading} style={btnPrimary}>
                {loading ? (isSignUp ? "Creating account…" : "Opening memoira…") : (isSignUp ? "Create account" : "Sign in")}
              </button>
              <div className="flex items-center justify-between">
                <button type="button"
                  onClick={() => { setIsSignUp(v => !v); setError(""); setSuccessMsg(""); }}
                  className="font-[family-name:var(--font-caveat)] text-base transition-opacity hover:opacity-70"
                  style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer" }}>
                  {isSignUp ? "Sign in →" : "Create account →"}
                </button>
                {!isSignUp && (
                  <button type="button"
                    onClick={handleForgotPassword}
                    className="font-[family-name:var(--font-caveat)] text-sm transition-opacity hover:opacity-70"
                    style={{ background: "none", border: "none", color: "#9a8070", cursor: "pointer" }}>
                    Forgot password?
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Magic link form */}
          {mode === "magic" && !magicSent && (
            <form onSubmit={handleMagic} className="space-y-3">
              <input type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              <button type="submit" disabled={loading} style={btnPrimary}>
                {loading ? "Sending…" : "Send magic link"}
              </button>
              <p className="font-[family-name:var(--font-caveat)] text-sm text-center" style={{ color: "#9a8070" }}>
                We&apos;ll email you a one-click sign-in link.
              </p>
            </form>
          )}

          {/* Magic link sent */}
          {mode === "magic" && magicSent && (
            <div className="text-center space-y-2 py-2">
              <p className="text-3xl">✦</p>
              <p className="font-[family-name:var(--font-caveat)] text-xl font-bold" style={{ color: "#2e3e20" }}>
                Check your inbox
              </p>
              <p className="font-[family-name:var(--font-caveat)] text-base" style={{ color: "#6a7e5a" }}>
                Magic link sent to <strong>{email}</strong>.
              </p>
              <button onClick={() => setMagicSent(false)}
                className="font-[family-name:var(--font-caveat)] text-sm transition-opacity hover:opacity-70"
                style={{ background: "none", border: "none", color: "#8b5e3c", cursor: "pointer" }}>
                Use a different email →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

