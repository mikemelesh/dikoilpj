from decimal import Decimal

from app.utils.loyalty import (
    calculate_discount_from_spent,
    calculate_loyalty_tier_from_spent,
    get_loyalty_progress,
)
from app.models.user import LoyaltyTier


def test_discount_below_threshold():
    assert calculate_discount_from_spent(Decimal("9999")) == 0.0


def test_discount_at_threshold():
    assert calculate_discount_from_spent(Decimal("10000")) == 5.0


def test_discount_steps():
    assert calculate_discount_from_spent(Decimal("15000")) == 6.0
    assert calculate_discount_from_spent(Decimal("20000")) == 7.0


def test_discount_cap():
    assert calculate_discount_from_spent(Decimal("50000")) == 12.0


def test_tiers():
    assert calculate_loyalty_tier_from_spent(Decimal("5000")) == LoyaltyTier.BRONZE
    assert calculate_loyalty_tier_from_spent(Decimal("12000")) == LoyaltyTier.SILVER
    assert calculate_loyalty_tier_from_spent(Decimal("25000")) == LoyaltyTier.GOLD
    assert calculate_loyalty_tier_from_spent(Decimal("45000")) == LoyaltyTier.PLATINUM


def test_progress_to_first_tier():
    p = get_loyalty_progress(Decimal("8000"))
    assert p["current_discount_percent"] == 0.0
    assert p["next_discount_percent"] == 5.0
    assert p["amount_to_next"] == 2000.0


def test_progress_between_tiers():
    p = get_loyalty_progress(Decimal("15000"))
    assert p["current_discount_percent"] == 6.0
    assert p["next_discount_percent"] == 7.0
    assert p["next_threshold_spent"] == 20000.0
    assert p["amount_to_next"] == 5000.0
