"""
Утилиты для расчётов и программы лояльности.
"""
from decimal import Decimal
from typing import Tuple

from sqlalchemy.orm import Session

from ..models.client import Client, LoyaltyTier


# Пороги для уровней лояльности (баллы)
LOYALTY_THRESHOLDS = {
    LoyaltyTier.BRONZE: 0,
    LoyaltyTier.SILVER: 500,
    LoyaltyTier.GOLD: 2000,
    LoyaltyTier.PLATINUM: 5000,
}

# Процент начисления баллов от суммы заказа
LOYALTY_POINTS_PERCENT = {
    LoyaltyTier.BRONZE: Decimal("1.0"),  # 1%
    LoyaltyTier.SILVER: Decimal("1.5"),  # 1.5%
    LoyaltyTier.GOLD: Decimal("2.0"),    # 2%
    LoyaltyTier.PLATINUM: Decimal("3.0"), # 3%
}


def calculate_loyalty_tier(total_orders: int, loyalty_points: int) -> LoyaltyTier:
    """
    Расчёт уровня лояльности на основе накопленных баллов.
    """
    if loyalty_points >= LOYALTY_THRESHOLDS[LoyaltyTier.PLATINUM]:
        return LoyaltyTier.PLATINUM
    elif loyalty_points >= LOYALTY_THRESHOLDS[LoyaltyTier.GOLD]:
        return LoyaltyTier.GOLD
    elif loyalty_points >= LOYALTY_THRESHOLDS[LoyaltyTier.SILVER]:
        return LoyaltyTier.SILVER
    else:
        return LoyaltyTier.BRONZE


def calculate_loyalty_points(amount: Decimal, tier: LoyaltyTier) -> int:
    """
    Расчёт баллов для начисления по сумме заказа.
    """
    points_percent = LOYALTY_POINTS_PERCENT.get(tier, Decimal("1.0"))
    return int(amount * points_percent / Decimal("100"))


def apply_client_discount(
    total_price: Decimal,
    client: Client
) -> Tuple[Decimal, Decimal, Decimal]:
    """
    Применение скидки клиента.
    
    Возвращает: (discount_amount, final_price, total_price)
    """
    discount_percent = Decimal(str(client.discount_percent or 0.0))
    discount_amount = total_price * discount_percent / Decimal("100")
    final_price = total_price - discount_amount
    
    return discount_amount, final_price, total_price


def update_client_loyalty(
    db: Session,
    client: Client,
    order_amount: Decimal
) -> Client:
    """
    Обновление программы лояльности клиента после завершения заказа.
    
    - Увеличивает total_orders
    - Начисляет loyalty_points
    - Пересчитывает loyalty_tier
    """
    # Увеличиваем счётчик заказов
    client.total_orders += 1
    
    # Начисляем баллы
    points_to_add = calculate_loyalty_points(order_amount, LoyaltyTier(client.loyalty_tier))
    client.user.loyalty_points += points_to_add
    
    # Пересчитываем уровень
    new_tier = calculate_loyalty_tier(
        client.total_orders,
        client.user.loyalty_points
    )
    client.loyalty_tier = new_tier.value
    
    db.add(client)
    db.add(client.user)
    
    return client
