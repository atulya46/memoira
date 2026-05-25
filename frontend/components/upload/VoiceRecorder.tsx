"use client";
import { useState, useRef, useEffect } from "react";
import { uploadVoice } from "@/lib/storage";

interface Props {
  tripId: string;
  onUploaded: () => void;
}

export default function VoiceRecorder({ tripId, onUploaded }: Props) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Read display name from localStorage for use in transcription
    const name = localStorage.getItem("memoiraaa_user_name") ?? "";
    setDisplayName(name);
  }, []);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Pick the first MIME type the device supports — iOS uses audio/mp4, desktop uses audio/webm
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg"]
      .find(t => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = handleStop;
    recorder.start();
    mediaRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }

  async function handleStop() {
    // Use the recorder's actual mimeType (audio/mp4 on iOS, audio/webm on desktop)
    const mimeType = mediaRef.current?.mimeType || "audio/mp4";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    setUploading(true);
    try {
      await uploadVoice(blob, tripId, displayName);
      setDone(true);
      // Brief confirmation flash then close panel
      setTimeout(() => {
        setDone(false);
        onUploaded();
      }, 1000);
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#5a7a40" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polyline points="3,9 7,13 15,5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#5a7a40" }}>Saved!</p>
      </div>
    );
  }

  if (uploading) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {/* Animated waveform bars */}
        <div className="flex items-end gap-1" style={{ height: 32 }}>
          {[0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6].map((h, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 4,
                background: "#8b5e3c",
                height: `${h * 100}%`,
                animation: `bounce 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
        <style>{`@keyframes bounce { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
        <p className="font-[family-name:var(--font-caveat)] text-lg" style={{ color: "#8b5e3c" }}>
          Transcribing…
        </p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: "#c0392b" }} />
          <span className="font-[family-name:var(--font-caveat)] text-2xl font-bold" style={{ color: "#3a2510" }}>
            {fmt(seconds)}
          </span>
        </div>
        {/* Live waveform animation while recording */}
        <div className="flex items-end gap-1" style={{ height: 24 }}>
          {[0.5, 0.8, 0.6, 1.0, 0.7, 0.9, 0.5].map((h, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 3,
                background: "#c0392b",
                height: `${h * 100}%`,
                animation: `bounce 0.5s ease-in-out ${i * 0.08}s infinite alternate`,
                opacity: 0.75,
              }}
            />
          ))}
        </div>
        <button onClick={stopRecording}
          className="font-[family-name:var(--font-caveat)] text-base px-6 py-2 rounded-xl transition-opacity hover:opacity-80"
          style={{ background: "#c0392b", color: "#fff" }}>
          Stop recording
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="text-3xl">🎙</div>
      <button onClick={startRecording}
        className="font-[family-name:var(--font-caveat)] text-base px-6 py-2.5 rounded-xl transition-opacity hover:opacity-85"
        style={{ border: "1.5px solid rgba(139,94,60,0.4)", background: "rgba(250,244,234,0.7)", color: "#3a2510" }}>
        Start recording
      </button>
      <p className="font-[family-name:var(--font-caveat)] text-sm" style={{ color: "#9a8070" }}>
        Narrate your memories — we&apos;ll transcribe it
      </p>
    </div>
  );
}
