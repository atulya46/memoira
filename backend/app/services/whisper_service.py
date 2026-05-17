from __future__ import annotations
import httpx
import io
from groq import Groq
from app.config import settings

client = Groq(api_key=settings.groq_api_key)


async def transcribe_audio_bytes(audio_bytes: bytes) -> str:
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "voice_note.webm"

    transcription = client.audio.transcriptions.create(
        file=audio_file,
        model="whisper-large-v3",
    )

    return transcription.text


async def transcribe_audio(audio_url: str) -> str:
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(audio_url)
        response.raise_for_status()
        audio_bytes = response.content

    return await transcribe_audio_bytes(audio_bytes)
