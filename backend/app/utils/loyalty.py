"""
Программа лояльности: скидка от суммы завершённых заказов (BYN).

- от 10 000 BYN: 5%
- +1% за каждые 5 000 BYN сверх порога
- максимум 12%
"""
from decimal import Decimal
from typing import Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.client import Client
from ..models.order import Order, OrderStatus
from ..models.user import LoyaltyTier

LOYALTY_SPEND_THRESHOLD = Decimal("10000")
LOYALTY_SPEND_STEP = Decimal("5000")
LOYALTY_BASE_DISCOUNT = 5
LOYALTY_MAX_DISCOUNT = 12


def calculate_discount_from_spent(total_spent: Decimal) -> float:
    """Процент скидки по накопленной сумме завершённых заказов."""
    spent = Decimal(str(total_spent or 0))
    if spent < LOYALTY_SPEND_THRESHOLD:
        return 0.0
    extra_steps = int((spent - LOYALTY_SPEND_THRESHOLD) // LOYALTY_SPEND_STEP)
    return float(min(LOYALTY_MAX_DISCOUNT, LOYALTY_BASE_DISCOUNT + extra_steps))


def calculate_loyalty_tier_from_spent(total_spent: Decimal) -> LoyaltyTier:
    """Уровень лояльности для отображения (по сумме трат)."""
    discount = calculate_discount_from_spent(total_spent)
    if discount >= 10:
        return LoyaltyTier.PLATINUM
    if discount >= 7:
        return LoyaltyTier.GOLD
    if discount >= 5:
        return LoyaltyTier.SILVER
    return LoyaltyTier.BRONZE


def get_client_total_spent(db: Session, client_id: int) -> Decimal:
    """Сумма final_price по завершённым заказам клиента."""
    total = (
        db.query(func.coalesce(func.sum(Order.final_price), 0))
        .filter(
            Order.client_id == client_id,
            Order.status == OrderStatus.COMPLETED,
        )
        .scalar()
    )
    return Decimal(str(total or 0))


def get_loyalty_progress(total_spent: Decimal) -> dict:
    """Пороги для UI: текущая скидка и следующий уровень."""
    spent = Decimal(str(total_spent or 0))
    current_discount = calculate_discount_from_spent(spent)

    if spent < LOYALTY_SPEND_THRESHOLD:
        return {
            "current_discount_percent": current_discount,
            "next_discount_percent": float(LOYALTY_BASE_DISCOUNT),
            "next_threshold_spent": float(LOYALTY_SPEND_THRESHOLD),
            "amount_to_next": float(LOYALTY_SPEND_THRESHOLD - spent),
            "is_max_tier": False,
        }

    if current_discount >= LOYALTY_MAX_DISCOUNT:
        return {
            "current_discount_percent": current_discount,
            "next_discount_percent": None,
            "next_threshold_spent": None,
            "amount_to_next": 0.0,
            "is_max_tier": True,
        }

    next_discount = current_discount + 1
    steps_for_next = int(next_discount - LOYALTY_BASE_DISCOUNT)
    next_threshold = LOYALTY_SPEND_THRESHOLD + LOYALTY_SPEND_STEP * steps_for_next

    return {
        "current_discount_percent": current_discount,
        "next_discount_percent": float(next_discount),
        "next_threshold_spent": float(next_threshold),
        "amount_to_next": float(max(Decimal("0"), next_threshold - spent)),
        "is_max_tier": False,
    }


def sync_client_loyalty_from_spent(db: Session, client: Client) -> Client:
    """Пересчитать скидку и уровень по завершённым заказам."""
    total_spent = get_client_total_spent(db, client.id)
    client.discount_percent = calculate_discount_from_spent(total_spent)
    client.loyalty_tier = calculate_loyalty_tier_from_spent(total_spent).value
    db.add(client)
    return client


def apply_client_discount(
    total_price: Decimal,
    client: Client,
    db: Session,
) -> Tuple[Decimal, Decimal, Decimal]:
    """
    Применить скидку лояльности к сумме заказа.

    Возвращает: (discount_amount, final_price, total_price)
    """
    sync_client_loyalty_from_spent(db, client)
    discount_percent = Decimal(str(client.discount_percent or 0.0))
    discount_amount = total_price * discount_percent / Decimal("100")
    final_price = total_price - discount_amount
    return discount_amount, final_price, total_price


def update_client_loyalty(
    db: Session,
    client: Client,
    _order_amount: Decimal,
) -> Client:
    """
    Обновление лояльности после завершения заказа.
    Расчёт по сумме всех заказов со статусом completed.
    """
    db.flush()
    client.total_orders = (
        db.query(func.count(Order.id))
        .filter(
            Order.client_id == client.id,
            Order.status == OrderStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    sync_client_loyalty_from_spent(db, client)
    return client


def build_client_profile_snapshot(db: Session, client: Client) -> dict:
    """Данные лояльности для auth/me и client_profile."""
    sync_client_loyalty_from_spent(db, client)
    total_spent = get_client_total_spent(db, client.id)
    progress = get_loyalty_progress(total_spent)
    return {
        "id": client.id,
        "client_type": client.client_type.value if hasattr(client.client_type, "value") else client.client_type,
        "clinic_name": client.clinic_name,
        "address": client.address,
        "discount_percent": client.discount_percent,
        "loyalty_tier": client.loyalty_tier,
        "total_orders": client.total_orders,
        "total_spent": float(total_spent),
        "loyalty_progress": progress,
    }


def recalculate_all_clients_loyalty(db: Session) -> int:
    """Пересчитать лояльность для всех клиентов (после миграции / импорта)."""
    clients = db.query(Client).all()
    for client in clients:
        sync_client_loyalty_from_spent(db, client)
        client.total_orders = (
            db.query(func.count(Order.id))
            .filter(
                Order.client_id == client.id,
                Order.status == OrderStatus.COMPLETED,
            )
            .scalar()
            or 0
        )
        db.add(client)
    db.commit()
    return len(clients)
