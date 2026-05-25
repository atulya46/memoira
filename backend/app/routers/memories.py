from __future__ import annotations
import uuid, io, re
from fastapi import APIRouter, BackgroundTasks, HTTPException, Header, UploadFile, File, Form
from app.models.schemas import MemoryProcessRequest, MemoryUpdateRequest
from app.db.client import supabase
from app.services import claude_service, whisper_service
from app.auth import get_owned_trip, get_user_id
from app.media import sign_memory
from app.rate_limit import check_rate_limit
from PIL import Image, ExifTags

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_AUDIO_BYTES = 15 * 1024 * 1024
MAX_PHOTOS_PER_TRIP = 20
MAX_NOTES_PER_TRIP = 200
MAX_NOTE_CHARS = 10_000
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
ALLOWED_AUDIO_TYPES = {
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/wave",
    "audio/webm",
    "audio/x-m4a",
    "audio/x-wav",
    "video/webm",
}
Image.MAX_IMAGE_PIXELS = 25_000_000


def _extract_exif(image_bytes: bytes) -> dict:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        exif_raw = img._getexif()
        if not exif_raw:
            return {}
        result = {}
        for tag_id, value in exif_raw.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            if tag == "DateTimeOriginal":
                result["date_taken"] = str(value)          # "YYYY:MM:DD HH:MM:SS"
            elif tag == "GPSInfo":
                gps = {ExifTags.GPSTAGS.get(k, k): v for k, v in value.items()}
                if "GPSLatitude" in gps and "GPSLongitude" in gps:
                    lat = gps["GPSLatitude"]
                    lng = gps["GPSLongitude"]
                    lat_d = float(lat[0]) + float(lat[1]) / 60 + float(lat[2]) / 3600
                    lng_d = float(lng[0]) + float(lng[1]) / 60 + float(lng[2]) / 3600
                    if gps.get("GPSLatitudeRef") == "S":
                        lat_d = -lat_d
                    if gps.get("GPSLongitudeRef") == "W":
                        lng_d = -lng_d
                    result["gps_lat"] = round(lat_d, 6)
                    result["gps_lng"] = round(lng_d, 6)
        return result
    except Exception:
        return {}

router = APIRouter(prefix="/api/memories", tags=["memories"])


async def _analyze_photo_background(memory_id: str, file_bytes: bytes, content_type: str, exif: dict) -> None:
    try:
        ai_metadata = await claude_service.analyze_image_bytes(file_bytes, content_type)
        merged = {**ai_metadata, **exif}
    except Exception:
        merged = exif
    if merged:
        supabase.table("memories").update({"ai_metadata": merged}).eq("id", memory_id).execute()


async def _transcribe_voice_background(memory_id: str, file_bytes: bytes, display_name: str) -> None:
    try:
        raw = await whisper_service.transcribe_audio_bytes(file_bytes)
        _replacement = (display_name + ": ") if display_name else ""
        transcription = re.sub(
            r"(?im)^\s*\[?(narrator|speaker\s*\d*|unknown\s*speaker)\]?\s*[:.：]?\s*",
            _replacement,
            raw,
        ).strip()
    except Exception:
        transcription = ""

    entities: dict = {}
    if transcription:
        try:
            entities = await claude_service.extract_voice_entities(transcription, user_name=display_name)
        except Exception:
            pass

    updates: dict = {"ai_metadata": entities or {}}
    if transcription:
        updates["content"] = transcription
    supabase.table("memories").update(updates).eq("id", memory_id).execute()


def _upload_to_storage(file_bytes: bytes, path: str, content_type: str) -> str:
    # Upload via service role key — bypasses storage RLS entirely
    try:
        supabase.storage.from_("memories").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        message = str(exc).lower()
        if "bucket" not in message and "not found" not in message:
            raise
        try:
            supabase.storage.create_bucket("memories", options={"public": False})
        except Exception:
            pass
        supabase.storage.from_("memories").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    return path


def _validate_image_upload(file: UploadFile, file_bytes: bytes) -> str:
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image type")
    if not file_bytes or len(file_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 8 MB limit")
    try:
        image = Image.open(io.BytesIO(file_bytes))
        image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file") from None
    if content_type in {"image/heic", "image/heif"}:
        return "image/jpeg"
    return content_type


def _normalize_content_type(content_type: str | None) -> str:
    return (content_type or "").split(";", 1)[0].strip().lower()


def _looks_like_audio(file_bytes: bytes) -> str | None:
    if file_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    if file_bytes.startswith(b"OggS"):
        return "audio/ogg"
    if len(file_bytes) > 12 and file_bytes[4:8] == b"ftyp":
        return "audio/mp4"
    if file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WAVE":
        return "audio/wav"
    if file_bytes.startswith((b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
        return "audio/mpeg"
    return None


def _audio_extension(content_type: str) -> str:
    if content_type in {"audio/mp4", "audio/x-m4a", "audio/aac"}:
        return "m4a"
    if content_type in {"audio/wav", "audio/wave", "audio/x-wav"}:
        return "wav"
    if content_type == "audio/ogg":
        return "ogg"
    if content_type == "audio/mpeg":
        return "mp3"
    return "webm"


def _validate_audio_upload(file: UploadFile, file_bytes: bytes) -> str:
    if not file_bytes or len(file_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio exceeds the 15 MB limit")
    content_type = _normalize_content_type(file.content_type)
    if content_type in ALLOWED_AUDIO_TYPES:
        return "audio/webm" if content_type == "video/webm" else content_type

    sniffed_type = _looks_like_audio(file_bytes)
    if content_type in {"", "application/octet-stream"} and sniffed_type:
        return sniffed_type
    if sniffed_type and file.filename and "." in file.filename:
        return sniffed_type

    supported = ", ".join(sorted(t for t in ALLOWED_AUDIO_TYPES if not t.startswith("video/")))
    raise HTTPException(status_code=415, detail=f"Unsupported audio type. Supported types: {supported}")


def _count_trip_memories(trip_id: str, user_id: str, memory_type: str | None = None) -> int:
    query = (
        supabase.table("memories")
        .select("id", count="exact")
        .eq("trip_id", trip_id)
        .eq("user_id", user_id)
    )
    if memory_type:
        query = query.eq("type", memory_type)
    result = query.execute()
    return result.count or 0


@router.post("/upload-image", status_code=201)
async def upload_image(
    background_tasks: BackgroundTasks,
    trip_id: str = Form(...),
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    user_id = get_user_id(authorization)
    check_rate_limit(f"upload-image:{user_id}", limit=30, window_seconds=3600)
    get_owned_trip(trip_id, user_id, "id")
    if _count_trip_memories(trip_id, user_id, "photo") >= MAX_PHOTOS_PER_TRIP:
        raise HTTPException(status_code=409, detail="Photo limit reached for this trip")

    file_bytes = await file.read()
    content_type = _validate_image_upload(file, file_bytes)
    extension = "jpg" if content_type == "image/jpeg" else content_type.removeprefix("image/")
    path = f"{user_id}/{trip_id}/{uuid.uuid4()}.{extension}"

    file_path = _upload_to_storage(file_bytes, path, content_type)
    exif = _extract_exif(file_bytes)

    # Insert memory immediately so upload always succeeds fast
    result = supabase.table("memories").insert({
        "trip_id": trip_id,
        "user_id": user_id,
        "type": "photo",
        "file_url": file_path,
        "ai_metadata": exif,
        "needs_clarification": False,
    }).execute()

    # AI analysis runs after response is returned — never blocks or times out the upload
    background_tasks.add_task(_analyze_photo_background, result.data[0]["id"], file_bytes, content_type, exif)

    return sign_memory(result.data[0])


@router.post("/upload-voice", status_code=201)
async def upload_voice(
    background_tasks: BackgroundTasks,
    trip_id: str = Form(...),
    file: UploadFile = File(...),
    authorization: str = Header(...),
    display_name: str = Form(default=""),
):
    user_id = get_user_id(authorization)
    check_rate_limit(f"upload-voice:{user_id}", limit=20, window_seconds=3600)
    get_owned_trip(trip_id, user_id, "id")

    file_bytes = await file.read()
    content_type = _validate_audio_upload(file, file_bytes)
    ext = _audio_extension(content_type)
    path = f"{user_id}/{trip_id}/{uuid.uuid4()}.{ext}"

    file_path = _upload_to_storage(file_bytes, path, content_type)

    # Insert memory immediately — transcription fills in via background task
    result = supabase.table("memories").insert({
        "trip_id": trip_id,
        "user_id": user_id,
        "type": "voice",
        "file_url": file_path,
        "content": "",
        "ai_metadata": {},
        "needs_clarification": False,
    }).execute()

    background_tasks.add_task(_transcribe_voice_background, result.data[0]["id"], file_bytes, display_name)

    return sign_memory(result.data[0])


@router.post("/{trip_id}/link-memories")
async def link_memories(trip_id: str, authorization: str = Header(...), display_name: str = ""):
    """Use AI to pair voice notes with related photos based on timestamps + semantic content."""
    user_id = get_user_id(authorization)
    get_owned_trip(trip_id, user_id, "id")
    memories = supabase.table("memories").select("*").eq("trip_id", trip_id).eq("user_id", user_id).execute()
    if not memories.data:
        return {"linked": []}

    pairs = await claude_service.link_voice_to_photos(memories.data, user_name=display_name)

    # Store linked photo in voice memory's ai_metadata
    for pair in pairs:
        voice_id = pair.get("voice_id")
        photo_id = pair.get("photo_id")
        if not voice_id or not photo_id:
            continue
        # Fetch current ai_metadata for this voice memory
        voice_mem = next((m for m in memories.data if m["id"] == voice_id and m["type"] == "voice"), None)
        if not voice_mem:
            continue
        existing_meta = voice_mem.get("ai_metadata") or {}
        if not isinstance(existing_meta, dict):
            existing_meta = {}
        if not any(m["id"] == photo_id and m["type"] == "photo" for m in memories.data):
            continue
        existing_meta["linked_photo_id"] = photo_id
        supabase.table("memories").update({"ai_metadata": existing_meta}).eq("id", voice_id).eq("trip_id", trip_id).eq("user_id", user_id).execute()

    return {"linked": pairs}


@router.post("/process-note", status_code=201)
async def process_note(body: MemoryProcessRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    check_rate_limit(f"process-note:{user_id}", limit=120, window_seconds=3600)
    get_owned_trip(body.trip_id, user_id, "id")
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")
    if len(content) > MAX_NOTE_CHARS:
        raise HTTPException(status_code=413, detail="Note exceeds the 10000 character limit")
    if _count_trip_memories(body.trip_id, user_id) >= MAX_NOTES_PER_TRIP:
        raise HTTPException(status_code=409, detail="Memory limit reached for this trip")

    result = supabase.table("memories").insert({
        "trip_id": body.trip_id,
        "user_id": user_id,
        "type": "note",
        "content": content,
        "ai_metadata": {},
        "needs_clarification": False,
    }).execute()

    return sign_memory(result.data[0])


@router.patch("/{memory_id}")
async def update_memory(memory_id: str, body: MemoryUpdateRequest, authorization: str = Header(...)):
    user_id = get_user_id(authorization)

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "day_assigned" in updates:
        if updates["day_assigned"] < 1:
            raise HTTPException(status_code=400, detail="Day must be positive")
        updates["needs_clarification"] = False
    if "content" in updates:
        updates["content"] = updates["content"].strip()
        if not updates["content"]:
            raise HTTPException(status_code=400, detail="Content is required")
        if len(updates["content"]) > MAX_NOTE_CHARS:
            raise HTTPException(status_code=413, detail="Content exceeds the 10000 character limit")

    result = supabase.table("memories").update(updates).eq("id", memory_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    return sign_memory(result.data[0])


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(memory_id: str, authorization: str = Header(...)):
    user_id = get_user_id(authorization)
    existing = supabase.table("memories").select("id, file_url").eq("id", memory_id).eq("user_id", user_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Memory not found")
    file_path = existing.data[0].get("file_url")
    if file_path and not str(file_path).startswith(("http://", "https://")):
        supabase.storage.from_("memories").remove([file_path])
    supabase.table("memories").delete().eq("id", memory_id).eq("user_id", user_id).execute()
