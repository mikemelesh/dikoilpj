"""Расчёт скидок: программа лояльности + акции."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.promotion import Promotion, PromotionAppliesTo
from ..models.service import Service
from ..utils.loyalty import sync_client_loyalty_from_spent

MAX_TOTAL_DISCOUNT_PERCENT = 100.0


@dataclass(frozen=True)
class PromotionMatch:
    id: int
    title: str
    discount_percent: float
    applies_to: str


@dataclass(frozen=True)
class OrderDiscountBreakdown:
    loyalty_discount_percent: float
    promotion_discount_percent: float
    discount_percent: float
    discount_amount: Decimal
    final_price: Decimal
    discount_source: str
    applied_promotion_title: Optional[str]
    active_promotions: List[PromotionMatch]


def _service_category_map(db: Session, service_ids: Iterable[int]) -> dict[int, Optional[int]]:
    ids = {service_id for service_id in service_ids if service_id}
    if not ids:
        return {}

    rows = db.query(Service.id, Service.category_id).filter(Service.id.in_(ids)).all()
    return {service_id: category_id for service_id, category_id in rows}


def get_applicable_promotions(
    db: Session,
    service_ids: Sequence[int],
    *,
    today: Optional[date] = None,
) -> tuple[float, Optional[str], List[PromotionMatch]]:
    """Максимальная скидка среди подходящих акций и список активных акций для заказа."""
    today = today or date.today()
    category_by_service = _service_category_map(db, service_ids)

    active_promotions = db.query(Promotion).filter(
        Promotion.is_active == True,
        Promotion.start_date <= today,
        Promotion.end_date >= today,
    ).all()

    max_promo_discount = 0.0
    applied_promotion_title: Optional[str] = None
    promotion_matches: List[PromotionMatch] = []

    for promo in active_promotions:
        applies = False

        if promo.applies_to == PromotionAppliesTo.ALL:
            applies = True
        elif promo.applies_to == PromotionAppliesTo.SERVICE:
            applies = any(service_id == promo.target_id for service_id in service_ids)
        elif promo.applies_to == PromotionAppliesTo.CATEGORY:
            applies = any(
                category_by_service.get(service_id) == promo.target_id
                for service_id in service_ids
            )

        if not applies:
            continue

        promo_discount = float(promo.discount_percent)
        promotion_matches.append(
            PromotionMatch(
                id=promo.id,
                title=promo.title,
                discount_percent=promo_discount,
                applies_to=promo.applies_to.value,
            )
        )
        if promo_discount > max_promo_discount:
            max_promo_discount = promo_discount
            applied_promotion_title = promo.title
        elif promo_discount == max_promo_discount and not applied_promotion_title:
            applied_promotion_title = promo.title

    return max_promo_discount, applied_promotion_title, promotion_matches


def calculate_order_discounts(
    subtotal: Decimal,
    *,
    loyalty_discount_percent: float,
    promotion_discount_percent: float,
    applied_promotion_title: Optional[str] = None,
    active_promotions: Optional[List[PromotionMatch]] = None,
) -> OrderDiscountBreakdown:
    """Сложить скидку лояльности и акции, ограничив суммарный процент 100%."""
    loyalty_discount_percent = max(float(loyalty_discount_percent or 0.0), 0.0)
    promotion_discount_percent = max(float(promotion_discount_percent or 0.0), 0.0)

    discount_percent = min(
        MAX_TOTAL_DISCOUNT_PERCENT,
        loyalty_discount_percent + promotion_discount_percent,
    )

    if discount_percent <= 0:
        discount_source = "none"
    elif loyalty_discount_percent > 0 and promotion_discount_percent > 0:
        discount_source = "combined"
    elif promotion_discount_percent > 0:
        discount_source = "promotion"
    else:
        discount_source = "loyalty"

    discount_amount = subtotal * Decimal(str(discount_percent)) / Decimal("100")
    final_price = subtotal - discount_amount

    return OrderDiscountBreakdown(
        loyalty_discount_percent=loyalty_discount_percent,
        promotion_discount_percent=promotion_discount_percent,
        discount_percent=discount_percent,
        discount_amount=discount_amount,
        final_price=final_price,
        discount_source=discount_source,
        applied_promotion_title=applied_promotion_title if promotion_discount_percent > 0 else None,
        active_promotions=active_promotions or [],
    )


def calculate_discounts_for_client_order(
    db: Session,
    subtotal: Decimal,
    service_ids: Sequence[int],
    client: Optional[Client] = None,
) -> OrderDiscountBreakdown:
    """Полный расчёт скидок для заказа клиента."""
    loyalty_discount_percent = 0.0
    if client:
        sync_client_loyalty_from_spent(db, client)
        loyalty_discount_percent = float(client.discount_percent or 0.0)

    promotion_discount_percent, applied_promotion_title, active_promotions = get_applicable_promotions(
        db,
        service_ids,
    )

    return calculate_order_discounts(
        subtotal,
        loyalty_discount_percent=loyalty_discount_percent,
        promotion_discount_percent=promotion_discount_percent,
        applied_promotion_title=applied_promotion_title,
        active_promotions=active_promotions,
    )
