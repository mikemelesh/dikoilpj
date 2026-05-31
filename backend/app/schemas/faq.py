"""
Pydantic схемы для FAQ.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FaqBase(BaseModel):
    """Базовая схема FAQ."""
    question: str = Field(..., min_length=1, max_length=500, description="Вопрос")
    answer: str = Field(..., min_length=1, max_length=5000, description="Ответ")
    category: Optional[str] = Field(None, max_length=100, description="Категория")
    sort_order: int = Field(default=0, ge=0, description="Порядок сортировки")
    is_published: bool = Field(default=True, description="Опубликовано")


class FaqCreate(FaqBase):
    """Схема для создания FAQ."""
    pass


class FaqUpdate(BaseModel):
    """Схема для обновления FAQ."""
    question: Optional[str] = Field(None, min_length=1, max_length=500)
    answer: Optional[str] = Field(None, min_length=1, max_length=5000)
    category: Optional[str] = Field(None, max_length=100)
    sort_order: Optional[int] = Field(None, ge=0)
    is_published: Optional[bool] = None


class FaqResponse(BaseModel):
    """Схема ответа FAQ."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    answer: str
    category: Optional[str] = None
    sort_order: int
    is_published: bool
    created_at: datetime
    updated_at: datetime
