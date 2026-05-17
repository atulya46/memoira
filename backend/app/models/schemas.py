from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date


class TripCreate(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    cover_image_url: Optional[str] = None


class TripResponse(BaseModel):
    id: str
    user_id: str
    name: str
    start_date: date
    end_date: date
    cover_image_url: Optional[str]
    status: str
    created_at: str


class MemoryProcessRequest(BaseModel):
    trip_id: str
    file_url: Optional[str] = None   # not present for notes
    memory_type: str                  # photo | voice | note
    content: Optional[str] = None    # for notes


class MemoryUpdateRequest(BaseModel):
    day_assigned: Optional[int] = None
    content: Optional[str] = None


class ClarifyingQuestion(BaseModel):
    memory_id: str
    question: str


class ReconstructResponse(BaseModel):
    grouped: dict  # { "1": [memory_ids], "2": [...] }
    clarifying_questions: List[ClarifyingQuestion]


class ReactionCreate(BaseModel):
    emoji: str
    session_id: str
