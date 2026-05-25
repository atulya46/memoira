import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    // FastAPI returns detail as array for 422, string for other errors
    const message = Array.isArray(error.detail)
      ? error.detail.map((e: { msg: string }) => e.msg).join(", ")
      : error.detail ?? "Request failed";
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Trips
export const api = {
  trips: {
    list: () => request<Trip[]>("/api/trips"),
    create: (body: TripCreatePayload) =>
      request<Trip>("/api/trips", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => request<TripWithMemories>(`/api/trips/${id}`),
    reconstruct: (id: string) => request<ReconstructResult>(`/api/trips/${id}/reconstruct`, { method: "POST" }),
    generateScrapbook: (id: string) => request<Scrapbook>(`/api/trips/${id}/generate-scrapbook`, { method: "POST" }),
    getScrapbook: (id: string) => request<Scrapbook>(`/api/trips/${id}/scrapbook`),
    linkMemories: (id: string, displayName = "") =>
      request<{ linked: { voice_id: string; photo_id: string; reason: string }[] }>(
        `/api/trips/${id}/link-memories?display_name=${encodeURIComponent(displayName)}`,
        { method: "POST" }
      ),
  },

  memories: {
    processImage: (body: { trip_id: string; file_url: string }) =>
      request<Memory>("/api/memories/process-image", { method: "POST", body: JSON.stringify({ ...body, memory_type: "photo" }) }),
    processVoice: (body: { trip_id: string; file_url: string }) =>
      request<Memory>("/api/memories/process-voice", { method: "POST", body: JSON.stringify({ ...body, memory_type: "voice" }) }),
    processNote: (body: { trip_id: string; content: string }) =>
      request<Memory>("/api/memories/process-note", { method: "POST", body: JSON.stringify({ ...body, memory_type: "note" }) }),
    update: (id: string, body: Partial<Memory>) =>
      request<Memory>(`/api/memories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/memories/${id}`, { method: "DELETE" }),
  },

  scrapbooks: {
    get: (id: string) => request<Scrapbook>(`/api/scrapbooks/${id}`),
    update: (id: string, body: Partial<Scrapbook>) =>
      request<Scrapbook>(`/api/scrapbooks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    updatePage: (scrapbookId: string, pageId: string, body: Partial<ScrapbookPage>) =>
      request<ScrapbookPage>(`/api/scrapbooks/${scrapbookId}/pages/${pageId}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/api/scrapbooks/${id}`, { method: "DELETE" }),
    share: (id: string) => request<{ share_token: string }>(`/api/scrapbooks/${id}/share`, { method: "POST" }),
    getShared: (token: string) => request<SharedScrapbook>(`/api/scrapbooks/shared/${token}`),
    addReaction: (token: string, emoji: string, sessionId: string) =>
      request(`/api/scrapbooks/shared/${token}/reactions`, { method: "POST", body: JSON.stringify({ emoji, session_id: sessionId }) }),
    getReactions: (id: string) => request<Reaction[]>(`/api/scrapbooks/${id}/reactions`),
  },
};

// Types
export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  cover_image_url: string | null;
  status: "draft" | "reconstructing" | "ready";
  created_at: string;
  memories?: Pick<Memory, "id" | "type" | "file_url" | "content" | "ai_metadata" | "created_at">[];
  scrapbooks?: { id: string; theme: string }[];
}

export interface TripWithMemories extends Trip {
  memories: Memory[];
}

export interface TripCreatePayload {
  name: string;
  start_date?: string;
  end_date?: string;
  cover_image_url?: string;
}

export interface Memory {
  id: string;
  trip_id: string;
  user_id: string;
  type: "photo" | "voice" | "note";
  file_url: string | null;
  file_path?: string | null;
  thumbnail_url: string | null;
  content: string | null;
  day_assigned: number | null;
  ai_metadata: Record<string, unknown>;
  needs_clarification: boolean;
  created_at: string;
}

export interface ScrapbookPage {
  id: string;
  scrapbook_id: string;
  day_number: number;
  location_label: string | null;
  ai_summary: string | null;
  user_summary: string | null;
  layout_config: Record<string, unknown>;
  order_index: number;
}

export type ScrapbookTheme = "earthy" | "vintage" | "handdrawn";

export interface Scrapbook {
  id: string;
  trip_id: string;
  theme: ScrapbookTheme | string;
  share_token: string | null;
  is_shared: boolean;
  ai_config: Record<string, unknown>;
  scrapbook_pages: ScrapbookPage[];
}

export interface SharedScrapbook extends Scrapbook {
  trips: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
  memories: Memory[];
}

export interface Reaction {
  id: string;
  scrapbook_id: string;
  emoji: string;
  session_id: string;
  created_at: string;
}

export interface ReconstructResult {
  grouped: Record<string, string[]>;
  clarifying_questions: { memory_id: string; question: string }[];
}
