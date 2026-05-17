from __future__ import annotations

from typing import Any

from app.db.client import supabase

SIGNED_URL_TTL_SECONDS = 60 * 10


def create_signed_url(path: str | None) -> str | None:
    if not path:
        return None
    result = supabase.storage.from_("memories").create_signed_url(
        path, expires_in=SIGNED_URL_TTL_SECONDS
    )
    return result.get("signedURL")


def sign_memory(memory: dict[str, Any]) -> dict[str, Any]:
    signed = dict(memory)
    path = signed.get("file_path")
    if path:
        signed["file_url"] = create_signed_url(path)
    return signed


def sign_memories(memories: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [sign_memory(memory) for memory in (memories or [])]
