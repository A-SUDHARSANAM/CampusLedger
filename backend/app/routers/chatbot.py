"""
app/routers/chatbot.py
======================
POST /chatbot/query — role-based Campus Asset Assistant endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.services.chatbot_service import process_message

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


class ChatbotQuery(BaseModel):
    message: str
    user_role: str
    user_id: str


class ChatbotResponse(BaseModel):
    response: str


VALID_ROLES = {"admin", "lab_technician", "service_staff"}


@router.post(
    "/query",
    response_model=ChatbotResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to the Campus Asset Assistant",
)
def chatbot_query(
    payload: ChatbotQuery,
    sb: Client = Depends(get_admin_client),
):
    if payload.user_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"user_role must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    answer = process_message(
        sb=sb,
        message=payload.message,
        user_role=payload.user_role,
        user_id=payload.user_id,
    )
    return ChatbotResponse(response=answer)
