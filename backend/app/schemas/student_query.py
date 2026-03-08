from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class StudentQueryCreate(BaseModel):
    student_name: str
    student_id: str
    department: str
    lab_id: str
    asset_id: Optional[str] = None
    issue_description: str
    priority: str = "medium"


class StudentQueryOut(BaseModel):
    id: str
    student_name: str
    student_id: str
    department: str
    lab_id: str
    asset_id: Optional[str] = None
    issue_description: str
    priority: str
    status: str
    assigned_technician: Optional[str] = None
    verified: bool
    helpful_score: int
    created_at: Optional[str] = None


class ConvertOut(BaseModel):
    maintenance_request_id: str
    query_id: str
    message: str


class ReviewOut(BaseModel):
    query_id: str
    decision: str
    verified: bool
    status: str
    helpful_score: int
    message: str
