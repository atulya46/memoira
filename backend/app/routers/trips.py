from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from app.auth import get_owned_trip, get_user_id
from app.db.client import supabase
from app.media import sign_memories
from app.models.schemas import TripCreate
from app.services import claude_service

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.get("")
async def list_trips(authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    result = (
        supabase.table("trips")
        .select("*, memories(id, type, file_path, file_url, ai_metadata, created_at), scrapbooks(id, theme)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    trips = result.data or []
    for trip in trips:
        trip["memories"] = sign_memories(trip.get("memories"))
    return trips


@router.post("", status_code=201)
async def create_trip(body: TripCreate, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    if body.end_date and body.start_date and body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Trip name is required")

    payload: dict = {
        "user_id": user_id,
        "name": name,
        "cover_image_url": body.cover_image_url,
        "status": "draft",
    }
    if body.start_date:
        payload["start_date"] = str(body.start_date)
    if body.end_date:
        payload["end_date"] = str(body.end_date)

    result = supabase.table("trips").insert(payload).execute()
    return result.data[0]


@router.get("/{trip_id}")
async def get_trip(trip_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    trip = get_owned_trip(trip_id, user_id)
    memories = (
        supabase.table("memories")
        .select("*")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {**trip, "memories": sign_memories(memories.data)}


@router.post("/{trip_id}/reconstruct")
async def reconstruct_timeline(trip_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    trip = get_owned_trip(trip_id, user_id)
    memories = (
        supabase.table("memories")
        .select("*")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )
    memory_rows = memories.data or []
    owned_memory_ids = {memory["id"] for memory in memory_rows}

    try:
        result = await claude_service.reconstruct_timeline(
            memory_rows,
            trip["start_date"],
            trip["end_date"],
        )
    except Exception:
        result = {"grouped": {}, "clarifying_questions": []}

    if not result.get("grouped"):
        result = {
            "grouped": {"1": [memory["id"] for memory in memory_rows]},
            "clarifying_questions": [],
        }

    sanitized_grouped: dict[str, list[str]] = {}
    for day_num, returned_ids in result.get("grouped", {}).items():
        try:
            day = int(day_num)
        except (TypeError, ValueError):
            continue
        if day < 1 or not isinstance(returned_ids, list):
            continue

        scoped_ids = [memory_id for memory_id in returned_ids if memory_id in owned_memory_ids]
        for memory_id in scoped_ids:
            (
                supabase.table("memories")
                .update({"day_assigned": day})
                .eq("id", memory_id)
                .eq("trip_id", trip_id)
                .eq("user_id", user_id)
                .execute()
            )
        sanitized_grouped[str(day)] = scoped_ids

    for question in result.get("clarifying_questions", []):
        memory_id = question.get("memory_id")
        if memory_id in owned_memory_ids:
            (
                supabase.table("memories")
                .update({"needs_clarification": True})
                .eq("id", memory_id)
                .eq("trip_id", trip_id)
                .eq("user_id", user_id)
                .execute()
            )

    (
        supabase.table("trips")
        .update({"status": "reconstructing"})
        .eq("id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )

    result["grouped"] = sanitized_grouped
    return result


@router.get("/{trip_id}/scrapbook")
async def get_trip_scrapbook(trip_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    get_owned_trip(trip_id, user_id, "id")
    result = (
        supabase.table("scrapbooks")
        .select("*, scrapbook_pages(*)")
        .eq("trip_id", trip_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Scrapbook not found")
    return result.data


@router.post("/{trip_id}/generate-scrapbook", status_code=201)
async def generate_scrapbook(trip_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    trip = get_owned_trip(trip_id, user_id)
    memories = (
        supabase.table("memories")
        .select("*")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .not_.is_("day_assigned", "null")
        .execute()
    )

    days_map: dict[str, list[dict]] = {}
    for memory in memories.data or []:
        day = str(memory["day_assigned"])
        days_map.setdefault(day, []).append(memory)

    days = [
        {"day_number": int(day), "memories": memories_for_day}
        for day, memories_for_day in sorted(days_map.items(), key=lambda item: int(item[0]))
    ]

    ai_content = await claude_service.generate_scrapbook_content(trip["name"], days)

    existing = supabase.table("scrapbooks").select("id").eq("trip_id", trip_id).execute()
    if existing.data:
        scrapbook_id = existing.data[0]["id"]
        supabase.table("scrapbooks").update({"ai_config": ai_content}).eq("id", scrapbook_id).execute()
    else:
        scrapbook_id = (
            supabase.table("scrapbooks")
            .insert({
                "trip_id": trip_id,
                "theme": "earthy",
                "is_shared": False,
                "ai_config": ai_content,
            })
            .execute()
            .data[0]["id"]
        )

    for day in days:
        day_num = day["day_number"]
        summary = ai_content.get("day_summaries", {}).get(str(day_num), "")
        existing_page = (
            supabase.table("scrapbook_pages")
            .select("id")
            .eq("scrapbook_id", scrapbook_id)
            .eq("day_number", day_num)
            .execute()
        )
        if existing_page.data:
            (
                supabase.table("scrapbook_pages")
                .update({"ai_summary": summary, "order_index": day_num})
                .eq("id", existing_page.data[0]["id"])
                .execute()
            )
        else:
            (
                supabase.table("scrapbook_pages")
                .insert({
                    "scrapbook_id": scrapbook_id,
                    "day_number": day_num,
                    "ai_summary": summary,
                    "order_index": day_num,
                    "layout_config": {},
                })
                .execute()
            )

    (
        supabase.table("trips")
        .update({"status": "ready"})
        .eq("id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )

    scrapbook = (
        supabase.table("scrapbooks")
        .select("*, scrapbook_pages(*)")
        .eq("id", scrapbook_id)
        .single()
        .execute()
    )
    return scrapbook.data


@router.post("/{trip_id}/link-memories")
async def link_memories(
    trip_id: str,
    authorization: str = Header(...),
    display_name: str = Query(default=""),
):
    user_id = get_user_id(authorization)
    get_owned_trip(trip_id, user_id, "id")
    memories = (
        supabase.table("memories")
        .select("*")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
        .execute()
    )
    memory_rows = memories.data or []
    if not memory_rows:
        return {"linked": []}

    pairs = await claude_service.link_voice_to_photos(memory_rows, user_name=display_name)
    photo_ids = {memory["id"] for memory in memory_rows if memory["type"] == "photo"}

    for pair in pairs:
        voice_id = pair.get("voice_id")
        photo_id = pair.get("photo_id")
        if not voice_id or photo_id not in photo_ids:
            continue

        voice_mem = next(
            (memory for memory in memory_rows if memory["id"] == voice_id and memory["type"] == "voice"),
            None,
        )
        if not voice_mem:
            continue

        meta = voice_mem.get("ai_metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        meta["linked_photo_id"] = photo_id
        (
            supabase.table("memories")
            .update({"ai_metadata": meta})
            .eq("id", voice_id)
            .eq("trip_id", trip_id)
            .eq("user_id", user_id)
            .execute()
        )

    return {"linked": pairs}
