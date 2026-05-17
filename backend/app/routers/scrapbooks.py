from __future__ import annotations
import uuid
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Header, Body
from app.models.schemas import ReactionCreate
from app.db.client import supabase
from app.auth import get_owned_scrapbook, get_user_id
from app.media import sign_memories
from app.rate_limit import check_rate_limit

router = APIRouter(prefix="/api/scrapbooks", tags=["scrapbooks"])

ALLOWED_THEMES = {"earthy", "vintage", "handdrawn"}
ALLOWED_REACTIONS = {"❤️", "😍", "🥹", "✨", "👏", "🔥"}


@router.get("/{scrapbook_id}")
async def get_scrapbook(scrapbook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    return get_owned_scrapbook(scrapbook_id, user_id)


@router.delete("/{scrapbook_id}", status_code=204)
async def delete_scrapbook(scrapbook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    existing = get_owned_scrapbook(scrapbook_id, user_id)
    # Also reset trip status back to reconstructing so user can regenerate
    supabase.table("trips").update({"status": "reconstructing"}).eq("id", existing["trip_id"]).eq("user_id", user_id).execute()
    supabase.table("scrapbooks").delete().eq("id", scrapbook_id).execute()


@router.put("/{scrapbook_id}")
async def update_scrapbook(scrapbook_id: str, body: Dict[str, Any] = Body(...), authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    get_owned_scrapbook(scrapbook_id, user_id)

    allowed = {k: body[k] for k in ("theme", "ai_config") if k in body}
    if "theme" in allowed and allowed["theme"] not in ALLOWED_THEMES:
        raise HTTPException(status_code=400, detail="Unsupported theme")
    if not allowed:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("scrapbooks").update(allowed).eq("id", scrapbook_id).execute()
    return result.data[0]


@router.put("/{scrapbook_id}/pages/{page_id}")
async def update_page(scrapbook_id: str, page_id: str, body: dict, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    get_owned_scrapbook(scrapbook_id, user_id)

    allowed = {k: body[k] for k in ("user_summary", "layout_config", "location_label") if k in body}
    if not allowed:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("scrapbook_pages").update(allowed).eq("id", page_id).eq("scrapbook_id", scrapbook_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Page not found")
    return result.data[0]


@router.post("/{scrapbook_id}/share")
async def share_scrapbook(scrapbook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    existing = get_owned_scrapbook(scrapbook_id, user_id)

    share_token = existing.get("share_token") or str(uuid.uuid4())
    supabase.table("scrapbooks").update({"is_shared": True, "share_token": share_token}).eq("id", scrapbook_id).execute()
    return {"share_token": share_token}


@router.get("/shared/{share_token}")
async def get_shared_scrapbook(share_token: str):
    result = supabase.table("scrapbooks").select("*, scrapbook_pages(*), trips(id, name, start_date, end_date)").eq("share_token", share_token).eq("is_shared", True).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Scrapbook not found")
    trip = result.data.get("trips") or {}
    memories = []
    if trip.get("id"):
        memories_result = supabase.table("memories").select("*").eq("trip_id", trip["id"]).execute()
        memories = sign_memories(memories_result.data)
    return {**result.data, "memories": memories}


@router.post("/shared/{share_token}/reactions", status_code=201)
async def add_reaction(share_token: str, body: ReactionCreate):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(status_code=400, detail="Unsupported reaction")
    session_id = body.session_id.strip()
    if not session_id or len(session_id) > 128:
        raise HTTPException(status_code=400, detail="Invalid session id")
    check_rate_limit(f"reaction:{share_token}:{session_id}", limit=10, window_seconds=3600)

    scrapbook = supabase.table("scrapbooks").select("id").eq("share_token", share_token).eq("is_shared", True).single().execute()
    if not scrapbook.data:
        raise HTTPException(status_code=404, detail="Scrapbook not found")

    result = supabase.table("reactions").insert({
        "scrapbook_id": scrapbook.data["id"],
        "emoji": body.emoji,
        "session_id": session_id,
    }).execute()
    return result.data[0]


@router.get("/{scrapbook_id}/reactions")
async def get_reactions(scrapbook_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    get_owned_scrapbook(scrapbook_id, user_id)

    result = supabase.table("reactions").select("*").eq("scrapbook_id", scrapbook_id).execute()
    return result.data
