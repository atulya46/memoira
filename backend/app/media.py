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
    stored_media = signed.get("file_path") or signed.get("file_url")
    if isinstance(stored_media, str) and stored_media.startswith(("http://", "https://")):
        signed["file_url"] = stored_media
        return signed

    path = stored_media
    if isinstance(path, str) and path:
        signed["file_url"] = create_signed_url(path)
    return signed


def sign_memories(memories: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return [sign_memory(memory) for memory in (memories or [])]
