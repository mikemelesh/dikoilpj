"""
Pydantic схемы для заказов.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# === Статусы и приоритеты ===


OrderStatusEnum = str  # "new", "confirmed", "in_progress", "review", "completed", "cancelled", "archived"
OrderPriorityEnum = str  # "normal", "urgent", "critical"


# === Позиции заказа ===


class OrderItemBase(BaseModel):
    """Базовая схема позиции заказа."""
    service_id: int = Field(..., gt=0, description="ID услуги")
    quantity: int = Field(default=1, ge=1, description="Количество")
    specifications: Optional[Dict[str, Any]] = Field(
        None, description="Спецификации (цвет, размер и т.д.)"
    )


class OrderItemCreate(OrderItemBase):
    """Схема для создания позиции заказа."""
    pass


class OrderItemResponse(BaseModel):
    """Схема ответа позиции заказа."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: str
    service_id: int
    service_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    specifications: Optional[Dict[str, Any]] = None


# === Файлы заказа ===


class OrderFileResponse(BaseModel):
    """Схема ответа файла заказа."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: str
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    created_at: datetime
    uploaded_by: str


# === История статусов ===


class OrderStatusHistoryResponse(BaseModel):
    """Схема ответа истории статусов."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: str
    old_status: str
    new_status: str
    comment: Optional[str] = None
    created_at: datetime
    changed_by: str


# === Заказ ===


class OrderBase(BaseModel):
    """Базовая схема заказа."""
    notes: Optional[str] = Field(None, max_length=2000, description="Заметки")
    deadline: Optional[date] = Field(None, description="Дедлайн")
    priority: str = Field(default="normal", description="Приоритет")


class OrderCreate(OrderBase):
    """Схема для создания заказа."""
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Позиции заказа")


class OrderUpdate(BaseModel):
    """Схема для обновления заказа."""
    notes: Optional[str] = Field(None, max_length=2000)
    deadline: Optional[date] = None
    priority: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    """Схема для изменения статуса заказа."""
    new_status: str = Field(..., description="Новый статус")
    comment: Optional[str] = Field(None, max_length=1000, description="Комментарий")


class OrderAssignRequest(BaseModel):
    """Схема для назначения исполнителя."""
    technician_id: int = Field(..., gt=0, description="ID техника")


class OrderResponse(BaseModel):
    """Схема ответа заказа."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    client_id: int
    client_name: Optional[str] = None
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
    manager_id: Optional[str] = None
    status: str
    priority: str
    total_price: float
    discount_amount: float
    final_price: float
    notes: Optional[str] = None
    deadline: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    items: List[OrderItemResponse] = Field(default_factory=list)
    files: List[OrderFileResponse] = Field(default_factory=list)
    status_history: List[OrderStatusHistoryResponse] = Field(default_factory=list)


class OrderListResponse(BaseModel):
    """Схема списка заказов с пагинацией."""
    items: List[OrderSummaryResponse]
    total: int
    page: int
    limit: int
    pages: int


class OrderSummaryResponse(BaseModel):
    """Краткая схема заказа для списков."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_number: str
    status: str
    priority: str
    final_price: float
    created_at: datetime
    deadline: Optional[date] = None
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None
