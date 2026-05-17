import { supabase } from "./supabase";
import { compressImage } from "./compress";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return `Bearer ${data.session?.access_token ?? ""}`;
}

// Upload goes browser → backend (service role) → Supabase Storage
// This bypasses storage RLS entirely — no policy setup needed
export async function uploadPhoto(file: File, tripId: string): Promise<string> {
  const compressed = await compressImage(file);
  const form = new FormData();
  form.append("trip_id", tripId);
  form.append("file", compressed, "photo.jpg");

  const res = await fetch(`${API_URL}/api/memories/upload-image`, {
    method: "POST",
    headers: { Authorization: await getAuthHeader() },
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data; // returns the full memory object
}

export async function uploadVoice(blob: Blob, tripId: string, displayName = ""): Promise<string> {
  const form = new FormData();
  form.append("trip_id", tripId);
  form.append("file", blob, "voice.webm");
  if (displayName) form.append("display_name", displayName);

  const res = await fetch(`${API_URL}/api/memories/upload-voice`, {
    method: "POST",
    headers: { Authorization: await getAuthHeader() },
    body: form,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}
