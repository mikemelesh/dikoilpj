# Pydantic schemas for orders and templates.
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# Status and priority enums
OrderStatusEnum = str
OrderPriorityEnum = str


# Order Templates
class OrderTemplateItem(BaseModel):
    service_id: int = Field(..., gt=0)
    quantity: int = Field(default=1, ge=1)
    service_name: Optional[str] = None
    specifications: Optional[Dict[str, Any]] = None


class OrderTemplateCreate(BaseModel):
    name: str = Field(..., max_length=255)
    items: List[OrderTemplateItem] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=2000)
    client_id: Optional[int] = Field(
        None,
        gt=0,
        description="ID клиента (обязательно для manager/admin)",
    )


class OrderTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    client_name: Optional[str] = None
    name: str
    items: list
    notes: Optional[str] = None
    created_at: datetime


class OrderTemplateListResponse(BaseModel):
    items: List[OrderTemplateResponse]
    total: int
    page: int
    limit: int
    pages: int


# Order Items
class OrderItemBase(BaseModel):
    service_id: int = Field(..., gt=0)
    quantity: int = Field(default=1, ge=1)
    specifications: Optional[Dict[str, Any]] = Field(None)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: str
    service_id: int
    service_name: Optional[str] = None
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    specifications: Optional[Dict[str, Any]] = None


# Files
class OrderFileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: str
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    created_at: datetime
    uploaded_by: str

    @field_validator('order_id', 'uploaded_by', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if v is None:
            return None
        return str(v)


# Status History
class OrderStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: str
    old_status: str
    new_status: str
    comment: Optional[str] = None
    created_at: datetime
    changed_by: str


# Orders
class OrderBase(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000)
    deadline: Optional[date] = Field(None)
    priority: str = Field(default="normal")

    @field_validator('deadline', mode='before')
    @classmethod
    def parse_deadline(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(..., min_length=1)
    template_id: Optional[int] = Field(None, description="ID template")
    repeat_from_order_id: Optional[str] = Field(None, description="Repeat from archive ID")


class OrderUpdate(BaseModel):
    notes: Optional[str] = Field(None, max_length=2000)
    deadline: Optional[date] = None
    priority: Optional[str] = None

    @field_validator('deadline', mode='before')
    @classmethod
    def parse_deadline(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v


class OrderStatusUpdate(BaseModel):
    new_status: str = Field(...)
    comment: Optional[str] = Field(None, max_length=1000)


class OrderAssignRequest(BaseModel):
    technician_id: int = Field(..., gt=0)


class OrderAssignManagerRequest(BaseModel):
    manager_id: str = Field(..., min_length=1)


class OrderResponse(BaseModel):
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


class OrderItemPriceUpdate(BaseModel):
    id: int
    unit_price: float = Field(..., ge=0)
    quantity: Optional[int] = Field(None, ge=1)


class OrderManagerPricingUpdate(BaseModel):
    """Корректировка цены менеджером до подтверждения заказа (status=new)."""
    final_price: Optional[float] = Field(None, ge=0)
    discount_amount: Optional[float] = Field(None, ge=0)
    items: Optional[List[OrderItemPriceUpdate]] = None
    notes: Optional[str] = Field(None, max_length=2000)


class OrderSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    order_number: str
    status: str
    priority: str
    final_price: float
    created_at: datetime
    deadline: Optional[date] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    technician_id: Optional[int] = None
    technician_name: Optional[str] = None


class OrderListResponse(BaseModel):
    items: List[OrderSummaryResponse]
    total: int
    page: int
    limit: int
    pages: int

