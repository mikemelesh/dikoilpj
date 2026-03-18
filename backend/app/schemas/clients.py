"""
Pydantic схемы для клиентов и техников.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# =============================================================================
# Клиенты
# =============================================================================


class ClientSummary(BaseModel):
    """Краткая информация о клиенте."""
    id: int
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    clinic_name: Optional[str] = None
    total_orders: int
    loyalty_tier: str
    discount_percent: float
    loyalty_points: int


class ClientOrderSummary(BaseModel):
    """Краткая информация о заказе клиента."""
    id: str
    order_number: str
    status: str
    final_price: float
    created_at: datetime


class ClientDetailResponse(BaseModel):
    """Детальная информация о клиенте."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    clinic_name: Optional[str] = None
    address: Optional[str] = None
    total_orders: int
    loyalty_tier: str
    discount_percent: float
    loyalty_points: int
    created_at: datetime

    last_orders: List[ClientOrderSummary] = Field(default_factory=list)


class ClientListResponse(BaseModel):
    """Список клиентов с пагинацией."""
    items: List[ClientSummary]
    total: int
    page: int
    limit: int
    pages: int


class ClientLoyaltyUpdate(BaseModel):
    """Обновление программы лояльности."""
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    loyalty_tier: Optional[str] = None


# =============================================================================
# Техники
# =============================================================================


class TechnicianSummary(BaseModel):
    """Краткая информация о технике."""
    id: int
    user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: int
    rating: float
    completed_orders: int
    is_available: bool


class TechnicianDetailResponse(BaseModel):
    """Детальная информация о технике."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: int
    rating: float
    completed_orders: int
    portfolio_description: Optional[str] = None
    is_available: bool
    created_at: datetime


class TechnicianStatsResponse(BaseModel):
    """Статистика техника."""
    total_orders: int = 0
    completed_orders: int = 0
    in_progress_orders: int = 0
    average_completion_days: Optional[float] = None
    rating: float = 0.0
    total_earnings: float = 0.0
    monthly_completed: List[Dict[str, Any]] = Field(default_factory=list)

    @field_validator('rating', 'total_earnings', mode='before')
    @classmethod
    def convert_decimal_to_float(cls, v):
        if v is None:
            return 0.0
        if isinstance(v, Decimal):
            return float(v)
        return float(v)

    @field_validator('total_orders', 'completed_orders', 'in_progress_orders', mode='before')
    @classmethod
    def convert_to_int(cls, v):
        if v is None:
            return 0
        return int(v)


class TechnicianPortfolioResponse(BaseModel):
    """Портфолио техника."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: int
    rating: float
    completed_orders: int
    portfolio_description: Optional[str] = None
    recent_works: List[dict] = Field(default_factory=list)


class TechnicianUpdate(BaseModel):
    """Обновление профиля техника."""
    specialization: Optional[str] = Field(None, max_length=200)
    portfolio_description: Optional[str] = Field(None, max_length=2000)
    is_available: Optional[bool] = None
