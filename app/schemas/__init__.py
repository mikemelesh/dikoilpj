from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr

from app.models import OrderStatus, PaymentType, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: UserRole
    company_name: Optional[str] = None
    unp: Optional[str] = None
    company_address: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str


# Service schemas
class ServiceCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class ServiceCategoryOut(ServiceCategoryBase):
    id: int

    class Config:
        orm_mode = True


class ServiceBase(BaseModel):
    name: str
    description: str
    base_price: float
    material: str
    production_time_days: int
    category: Optional[str] = None  # Для обратной совместимости
    category_id: Optional[int] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    material: Optional[str] = None
    production_time_days: Optional[int] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None


class ServiceOut(ServiceBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class ServiceListParams(BaseModel):
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None
    page: int = 1
    limit: int = 20


# Order schemas
class OrderItemCreate(BaseModel):
    service_id: int
    quantity: int = 1
    specifications: Optional[str] = None


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    notes: Optional[str] = None
    deadline: Optional[datetime] = None
    payment_type: PaymentType = PaymentType.CASH


class OrderUpdate(BaseModel):
    notes: Optional[str] = None
    deadline: Optional[datetime] = None
    items: Optional[List[OrderItemCreate]] = None


class OrderStatusUpdate(BaseModel):
    new_status: OrderStatus
    comment: Optional[str] = None


class OrderAssignRequest(BaseModel):
    technician_id: int


class OrderListParams(BaseModel):
    status: Optional[OrderStatus] = None
    priority: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    client_id: Optional[int] = None
    page: int = 1
    limit: int = 20


class OrderItemOut(BaseModel):
    id: int
    service_id: int
    quantity: int
    unit_price: float
    specifications: Optional[str] = None

    class Config:
        orm_mode = True


class OrderStatusHistoryOut(BaseModel):
    id: int
    old_status: Optional[str]
    new_status: str
    comment: Optional[str]
    changed_at: datetime
    changed_by: Optional[int]

    class Config:
        orm_mode = True


class OrderFileOut(BaseModel):
    id: int
    file_name: str
    file_path: str
    file_size: Optional[int]
    uploaded_at: datetime

    class Config:
        orm_mode = True


class OrderOut(BaseModel):
    id: int
    order_number: str
    client_id: int
    technician_id: Optional[int]
    status: str
    payment_type: str
    total_price: float
    notes: Optional[str]
    rejection_message: Optional[str]
    created_at: Optional[datetime]
    approved_at: Optional[datetime]
    completed_at: Optional[datetime]
    items: List[OrderItemOut]
    status_history: Optional[List[OrderStatusHistoryOut]] = None
    files: Optional[List[OrderFileOut]] = None

    class Config:
        orm_mode = True


class ServiceCategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        orm_mode = True

