"""
Pydantic схемы для материалов и запросов.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Материалы
# =============================================================================


class MaterialBase(BaseModel):
    """Базовая схема материала."""
    name: str = Field(..., min_length=1, max_length=200, description="Название материала")
    description: Optional[str] = Field(None, max_length=1000, description="Описание")
    unit: str = Field(..., min_length=1, max_length=50, description="Единица измерения")
    min_quantity: Decimal = Field(..., ge=0, decimal_places=2, description="Минимальное количество")
    price_per_unit: Decimal = Field(..., ge=0, decimal_places=2, description="Цена за единицу")
    supplier: Optional[str] = Field(None, max_length=200, description="Поставщик")


class MaterialCreate(MaterialBase):
    """Схема для создания материала."""
    pass


class MaterialUpdate(BaseModel):
    """Схема для обновления материала."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    quantity: Optional[Decimal] = Field(None, ge=0)
    min_quantity: Optional[Decimal] = Field(None, ge=0)
    price_per_unit: Optional[Decimal] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=200)


class MaterialResponse(MaterialBase):
    """Схема ответа материала."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    quantity: Decimal
    created_at: datetime
    updated_at: datetime


class MaterialListResponse(BaseModel):
    """Список материалов."""
    items: list[MaterialResponse]
    total: int


# =============================================================================
# Запросы материалов
# =============================================================================


class MaterialRequestStatusEnum(str):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ISSUED = "issued"


class MaterialRequestCreate(BaseModel):
    """Создание запроса материала."""
    material_id: int = Field(..., gt=0, description="ID материала")
    quantity_requested: Decimal = Field(..., gt=0, decimal_places=2, description="Запрашиваемое количество")
    comment: Optional[str] = Field(None, max_length=500, description="Комментарий")


class MaterialRequestUpdate(BaseModel):
    """Обновление запроса материала."""
    status: str = Field(..., description="Статус (approved/rejected)")
    comment: Optional[str] = Field(None, max_length=500, description="Комментарий")


class MaterialRequestResponse(BaseModel):
    """Схема ответа запроса материала."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    technician_id: int
    technician_name: Optional[str] = None
    material_id: int
    material_name: Optional[str] = None
    quantity_requested: Decimal
    quantity_available: Decimal
    status: str
    comment: Optional[str] = None
    created_at: datetime
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None


class MaterialRequestListResponse(BaseModel):
    """Список запросов материалов."""
    items: list[MaterialRequestResponse]
    total: int
