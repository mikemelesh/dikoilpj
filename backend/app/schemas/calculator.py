"""
Pydantic схемы для калькулятора услуг.
"""
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CalculatorItem(BaseModel):
    """Элемент для расчёта."""
    service_id: int = Field(..., gt=0, description="ID услуги")
    quantity: int = Field(default=1, ge=1, description="Количество")


class CalculatorRequest(BaseModel):
    """Запрос на расчёт стоимости."""
    items: List[CalculatorItem] = Field(..., min_length=1, description="Список услуг")
    client_id: Optional[int] = Field(None, gt=0, description="ID клиента (для скидки)")


class CalculatedItem(BaseModel):
    """Рассчитанный элемент."""
    service_id: int
    service_name: str
    quantity: int
    unit_price: Decimal
    total: Decimal


class PromotionInfo(BaseModel):
    """Информация об акции."""
    id: int
    title: str
    discount_percent: float
    applies_to: str


class CalculatorResponse(BaseModel):
    """Ответ калькулятора."""
    items: List[CalculatedItem]
    subtotal: Decimal
    discount_percent: float = Field(default=0.0, description="Процент скидки")
    discount_amount: Decimal
    loyalty_discount_percent: float = Field(default=0.0, description="Скидка программы лояльности")
    promotion_discount_percent: float = Field(default=0.0, description="Макс. скидка по акциям")
    discount_source: str = Field(
        default="none",
        description="Источник скидки: none | loyalty | promotion | combined",
    )
    applied_promotion_title: Optional[str] = Field(None, description="Название акции, если она применена")
    active_promotions: List[PromotionInfo]
    final_price: Decimal
