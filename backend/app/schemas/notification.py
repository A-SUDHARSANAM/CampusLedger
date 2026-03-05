from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class NotificationBase(BaseModel):
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: str


class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class NotificationResponse(NotificationBase):
    id: str
    is_read: bool
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
