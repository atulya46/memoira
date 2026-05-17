from __future__ import annotations

from fastapi import HTTPException
from postgrest.exceptions import APIError

from app.db.client import supabase


def get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authorization token") from None

    user_id = getattr(getattr(user, "user", None), "id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    return user_id


def get_owned_trip(trip_id: str, user_id: str, fields: str = "*") -> dict:
    try:
        result = (
            supabase.table("trips")
            .select(fields)
            .eq("id", trip_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except APIError:
        raise HTTPException(status_code=404, detail="Trip not found") from None

    if not result.data:
        raise HTTPException(status_code=404, detail="Trip not found")
    return result.data


def get_owned_scrapbook(scrapbook_id: str, user_id: str) -> dict:
    try:
        result = (
            supabase.table("scrapbooks")
            .select("*, trips(user_id)")
            .eq("id", scrapbook_id)
            .single()
            .execute()
        )
    except APIError:
        raise HTTPException(status_code=404, detail="Scrapbook not found") from None

    if not result.data or result.data.get("trips", {}).get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Scrapbook not found")
    return result.data
