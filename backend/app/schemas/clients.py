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


class ClientLoyaltyProgress(BaseModel):
    """Прогресс до следующего уровня скидки."""
    current_discount_percent: float
    next_discount_percent: Optional[float] = None
    next_threshold_spent: Optional[float] = None
    amount_to_next: float = 0.0
    is_max_tier: bool = False


class ClientLoyaltyResponse(BaseModel):
    """Программа лояльности клиента."""
    total_spent: float
    total_orders: int
    loyalty_tier: str
    discount_percent: float
    progress: ClientLoyaltyProgress
    rules: dict = Field(
        default_factory=lambda: {
            "threshold_spent": 10000,
            "base_discount_percent": 5,
            "step_spent": 5000,
            "step_discount_percent": 1,
            "max_discount_percent": 12,
            "currency": "BYN",
        }
    )


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
    total_spent: float = 0.0
    loyalty_tier: str
    discount_percent: float
    loyalty_points: int
    created_at: datetime


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
    total_spent: float = 0.0
    loyalty_tier: str
    discount_percent: float
    loyalty_points: int
    created_at: datetime
    loyalty_progress: Optional[ClientLoyaltyProgress] = None

    last_orders: List[ClientOrderSummary] = Field(default_factory=list)


class ClientListResponse(BaseModel):
    """Список клиентов с пагинацией."""
    items: List[ClientSummary]
    total: int
    page: int
    limit: int
    pages: int


class ClientLoyaltyUpdate(BaseModel):
    """Ручная корректировка (пересчитывается автоматически при завершении заказов)."""
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    loyalty_tier: Optional[str] = None


class ClientLoyaltyRecalculateResponse(BaseModel):
    """Результат пересчёта лояльности."""
    updated_clients: int


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
    portfolio_description: Optional[str] = None
    is_available: bool
    today_load: int = 0


class TechnicianListResponse(BaseModel):
    """Пагинированный список техников."""
    items: List[TechnicianSummary]
    total: int
    page: int
    limit: int
    pages: int


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
    today_load: int = 0
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
    """Публичное портфолио техника (без финансовых данных)."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: int
    rating: float
    completed_orders: int
    in_progress_orders: int = 0
    average_completion_days: Optional[float] = None
    portfolio_description: Optional[str] = None
    is_available: bool = True
    recent_works: List[dict] = Field(default_factory=list)


class TechnicianUpdate(BaseModel):
    """Обновление профиля техника (менеджер/админ)."""
    specialization: Optional[str] = Field(None, max_length=200)
    experience_years: Optional[int] = Field(None, ge=0)
    portfolio_description: Optional[str] = Field(None, max_length=2000)
    is_available: Optional[bool] = None


class TechnicianSelfUpdate(BaseModel):
    """Обновление своего профиля техником (без управления доступностью)."""
    specialization: Optional[str] = Field(None, max_length=200)
    experience_years: Optional[int] = Field(None, ge=0)
    portfolio_description: Optional[str] = Field(None, max_length=2000)
