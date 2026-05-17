"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const WORD_LIMIT = 500;

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

interface Props {
  tripId: string;
  onUploaded: () => void;
}

export default function NoteEditor({ tripId, onUploaded }: Props) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const wordCount = countWords(content);
  const overLimit = wordCount > WORD_LIMIT;
  const nearLimit = wordCount >= 400 && !overLimit;

  async function handleSave() {
    if (!content.trim() || overLimit) return;
    setSaving(true);
    try {
      await api.memories.processNote({ trip_id: tripId, content });
      setSaved(true);
      setContent("");
      // Brief "Saved!" flash, then notify parent (which closes the panel)
      setTimeout(() => {
        setSaved(false);
        onUploaded();
      }, 800);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 py-4">
      <textarea
        placeholder="Write about a moment, a meal, a feeling… anything worth remembering."
        rows={6}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded-xl p-3 resize-none outline-none font-[family-name:var(--font-caveat)] text-base"
        style={{
          border: "1.5px solid rgba(139,94,60,0.2)",
          background: "rgba(250,244,234,0.7)",
          color: "#1a1008",
        }}
        disabled={saving || saved}
      />
      <div className="flex items-center justify-between">
        <p className="font-[family-name:var(--font-caveat)] text-sm" style={{
          color: overLimit ? "#c0392b" : nearLimit ? "#e67e22" : "#9a8070"
        }}>
          {wordCount} / {WORD_LIMIT} words{overLimit ? " — too long" : ""}
        </p>
        <button
          onClick={handleSave}
          disabled={!content.trim() || saving || saved || overLimit}
          className="font-[family-name:var(--font-caveat)] text-base px-4 py-1.5 rounded-xl transition-opacity"
          style={{
            background: saved ? "#5a7a40" : "#8b5e3c",
            color: "#fff",
            opacity: (!content.trim() || saving || saved || overLimit) ? 0.6 : 1,
          }}>
          {saved ? "✓ Saved!" : saving ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
