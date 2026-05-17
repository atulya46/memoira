from __future__ import annotations
import httpx
import base64
import json
from google import genai
from google.genai import types
from app.config import settings

_client = genai.Client(api_key=settings.gemini_api_key)

IMAGE_CATEGORIES = [
    "food", "monument", "selfie", "nature", "nightlife",
    "architecture", "shopping", "transport", "candid", "other"
]

_JSON_CONFIG = types.GenerateContentConfig(
    response_mime_type="application/json",
)


async def analyze_image_bytes(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    response = _client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            (
                f"Analyze this travel photo. Return JSON only.\n"
                f"Fields:\n"
                f"- category: one of {IMAGE_CATEGORIES}\n"
                f"- description: one short sentence\n"
                f"- date_hint: any date or time of day visible (null if none)\n"
                f"- location_hint: any location name visible (null if none)"
            ),
        ],
        config=_JSON_CONFIG,
    )

    return _parse_json(response.text, fallback={"category": "other", "description": ""})


async def analyze_image(image_url: str) -> dict:
    image_bytes = await _fetch_bytes(image_url)
    return await analyze_image_bytes(image_bytes)


async def extract_voice_entities(transcription: str, user_name: str = "") -> dict:
    name_hint = f"The speaker's name is {user_name}. " if user_name else ""
    response = _client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=(
            f"Travel voice note transcription:\n\n\"{transcription}\"\n\n"
            f"{name_hint}"
            f"Extract structured info. Return JSON only.\n"
            f"Fields:\n"
            f"- entities: list of specific places, foods, or named people mentioned (exclude generic 'speaker', 'narrator', 'I', 'me')\n"
            f"- date_references: day/date mentions like 'yesterday', 'Day 2' (empty list if none)\n"
            f"- emotional_tone: one word (happy, nostalgic, excited, calm, funny, reflective)\n"
            f"- key_anecdote: the main story in one sentence using first person (null if none)"
        ),
        config=_JSON_CONFIG,
    )

    return _parse_json(response.text, fallback={"entities": [], "date_references": [], "emotional_tone": "neutral"})


async def link_voice_to_photos(memories: list, user_name: str = "") -> list[dict]:
    """Match voice notes to photos based on timestamps and semantic content.
    Returns a list of {voice_id, photo_id, confidence} dicts.
    """
    voices = [m for m in memories if m["type"] == "voice" and m.get("content")]
    photos = [m for m in memories if m["type"] == "photo"]

    if not voices or not photos:
        return []

    def _safe_meta(m: dict) -> dict:
        meta = m.get("ai_metadata")
        return meta if isinstance(meta, dict) else {}

    voices_text = "\n".join([
        f"VOICE id={v['id']} created={v['created_at'][:16]} "
        f"content=\"{(v.get('content') or '')[:200]}\""
        for v in voices
    ])
    photos_text = "\n".join([
        f"PHOTO id={p['id']} created={p['created_at'][:16]} "
        f"desc=\"{_safe_meta(p).get('description', '')}\" "
        f"date_taken=\"{_safe_meta(p).get('date_taken', '')}\""
        for p in photos
    ])

    response = _client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=(
            f"Match each voice note to its most likely related photo based on:\n"
            f"1. Timestamp proximity (prefer photos taken within 2 hours of voice recording)\n"
            f"2. Semantic match (voice note content mentions what the photo shows)\n"
            f"Only create a pair if there is a reasonable match. One voice can match one photo.\n\n"
            f"Voice notes:\n{voices_text}\n\n"
            f"Photos:\n{photos_text}\n\n"
            f"Return JSON array only. Format:\n"
            f"[{{\"voice_id\": \"...\", \"photo_id\": \"...\", \"reason\": \"brief explanation\"}}]\n"
            f"Return [] if no confident matches exist."
        ),
        config=_JSON_CONFIG,
    )

    result = response.text.strip()
    # Handle both array and object responses
    try:
        cleaned = result.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and "matches" in parsed:
            return parsed["matches"]
        return []
    except Exception:
        return []


async def reconstruct_timeline(memories: list, trip_start: str, trip_end: str) -> dict:
    from datetime import date
    start = date.fromisoformat(trip_start)
    end = date.fromisoformat(trip_end)
    num_days = (end - start).days + 1

    def _safe_meta(m: dict) -> dict:
        meta = m.get('ai_metadata')
        return meta if isinstance(meta, dict) else {}

    memories_text = "\n".join([
        f"ID: {m['id']} | Type: {m['type']} | "
        f"Date hint: {_safe_meta(m).get('date_hint') or _safe_meta(m).get('date_references') or 'none'} | "
        f"Description: {_safe_meta(m).get('description') or (m.get('content') or '')[:100]}"
        for m in memories
    ])
    all_ids = [m['id'] for m in memories]

    response = _client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=(
            f"You are organizing a {num_days}-day trip ({trip_start} to {trip_end}) into a day-by-day scrapbook.\n\n"
            f"RULES:\n"
            f"1. EVERY memory ID listed below MUST appear in 'grouped'. No exceptions.\n"
            f"2. Use day numbers 1 through {num_days}.\n"
            f"3. If a memory has no date hint, use context clues (type, description, order) to make your best guess. When truly unsure, spread memories evenly across days.\n"
            f"4. 'clarifying_questions' is optional — only add entries for memories where you genuinely need human input.\n\n"
            f"Memories to group:\n{memories_text}\n\n"
            f"All IDs that MUST appear in grouped: {all_ids}\n\n"
            f"Return JSON only. Format:\n"
            f"{{\"grouped\": {{\"1\": [\"id1\", \"id2\"], \"2\": [\"id3\"]}}, \"clarifying_questions\": []}}"
        ),
        config=_JSON_CONFIG,
    )

    result = _parse_json(response.text, fallback={"grouped": {}, "clarifying_questions": []})

    # Ensure every memory is assigned — put stragglers on day 1
    assigned = {mid for ids in result.get("grouped", {}).values() for mid in ids}
    missing = [m['id'] for m in memories if m['id'] not in assigned]
    if missing:
        result.setdefault("grouped", {}).setdefault("1", []).extend(missing)

    return result


async def generate_scrapbook_content(trip_name: str, days: list) -> dict:
    def _meta_desc(m: dict) -> str:
        meta = m.get('ai_metadata')
        desc = meta.get('description') if isinstance(meta, dict) else None
        return desc or (m.get('content') or '')[:120]

    days_text = "\n\n".join([
        f"Day {d['day_number']}:\n" + "\n".join([
            f"  - [{m['type']}] {_meta_desc(m)}"
            for m in d['memories']
        ])
        for d in days
    ])

    response = _client.models.generate_content(
        model="gemini-flash-lite-latest",
        contents=(
            f"Trip: \"{trip_name}\"\n\nMemories by day:\n{days_text}\n\n"
            f"Generate scrapbook content. Tone: warm and observational, not poetic.\n"
            f"Return JSON only.\n"
            f"Format: {{\n"
            f"  \"cover_tagline\": \"short personal subtitle\",\n"
            f"  \"scene_type\": \"dominant landscape/setting — one of: beach, forest, mountain, city_upscale, city_small, heritage, countryside, default. Use city_upscale for modern metros/skylines, city_small for old towns/villages/markets.\",\n"
            f"  \"day_summaries\": {{\"1\": \"one calm sentence\"}},\n"
            f"  \"places\": [\"Place Name 1\", \"Place Name 2\"],\n"
            f"  \"highlights\": {{\"best_meal\": null, \"calmest_memory\": null, \"funniest_moment\": null, \"most_photographed\": null}},\n"
            f"  \"reflection_prompts\": [\"Question 1?\", \"Question 2?\"]\n"
            f"}}"
        ),
        config=_JSON_CONFIG,
    )

    return _parse_json(response.text, fallback={
        "cover_tagline": "",
        "scene_type": "default",
        "day_summaries": {},
        "places": [],
        "highlights": {},
        "reflection_prompts": []
    })


def _parse_json(text: str, fallback: dict) -> dict:
    try:
        cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        result = json.loads(cleaned)
        return result if isinstance(result, dict) else fallback
    except Exception:
        return fallback


async def _fetch_bytes(url: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.content
