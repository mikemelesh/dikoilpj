"""
Pydantic схемы для услуг и категорий услуг.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# === Категории услуг ===


class ServiceCategoryBase(BaseModel):
    """Базовая схема категории услуг."""
    name: str = Field(..., min_length=1, max_length=100, description="Название категории")
    description: Optional[str] = Field(None, max_length=1000, description="Описание")
    icon_url: Optional[str] = Field(None, max_length=500, description="URL иконки")
    sort_order: int = Field(default=0, ge=0, description="Порядок сортировки")
    is_active: bool = Field(default=True, description="Активность категории")


class ServiceCategoryCreate(ServiceCategoryBase):
    """Схема для создания категории."""
    pass


class ServiceCategoryUpdate(BaseModel):
    """Схема для обновления категории."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    icon_url: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ServiceCategoryResponse(ServiceCategoryBase):
    """Схема ответа категории."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    services_count: int = Field(default=0, description="Количество услуг в категории")


class ServiceCategoryBrief(BaseModel):
    """Краткая категория для вложения в услугу."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


# === Услуги ===


class ServiceBase(BaseModel):
    """Базовая схема услуги."""
    name: str = Field(..., min_length=1, max_length=200, description="Название услуги")
    description: Optional[str] = Field(None, max_length=2000, description="Описание")
    base_price: Decimal = Field(..., ge=0, decimal_places=2, description="Базовая цена")
    unit: str = Field(..., min_length=1, max_length=50, description="Единица измерения")
    duration_days: int = Field(..., ge=0, description="Срок выполнения в днях")
    is_active: bool = Field(default=True, description="Активность услуги")


class ServiceCreate(ServiceBase):
    """Схема для создания услуги."""
    category_id: int = Field(..., gt=0, description="ID категории")


class ServiceUpdate(BaseModel):
    """Схема для обновления услуги."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    base_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    duration_days: Optional[int] = Field(None, ge=0)
    category_id: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None


class ServiceResponse(ServiceBase):
    """Схема ответа услуги."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    category_name: Optional[str] = None
    category: Optional[ServiceCategoryBrief] = None
    created_at: datetime
    updated_at: datetime


class ServiceListResponse(BaseModel):
    """Схема списка услуг с пагинацией."""
    items: list[ServiceResponse]
    total: int
    page: int
    limit: int
    pages: int
