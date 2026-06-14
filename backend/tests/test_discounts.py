from decimal import Decimal

from app.utils.discounts import calculate_order_discounts


def test_loyalty_and_promotion_discounts_add():
    breakdown = calculate_order_discounts(
        Decimal("1000.00"),
        loyalty_discount_percent=10.0,
        promotion_discount_percent=15.0,
        applied_promotion_title="Новогодняя акция",
    )

    assert breakdown.discount_percent == 25.0
    assert breakdown.discount_source == "combined"
    assert breakdown.discount_amount == Decimal("250.00")
    assert breakdown.final_price == Decimal("750.00")


def test_discounts_capped_at_100_percent():
    breakdown = calculate_order_discounts(
        Decimal("500.00"),
        loyalty_discount_percent=12.0,
        promotion_discount_percent=20.0,
    )

    assert breakdown.discount_percent == 32.0
    assert breakdown.discount_amount == Decimal("160.00")


def test_loyalty_only():
    breakdown = calculate_order_discounts(
        Decimal("200.00"),
        loyalty_discount_percent=5.0,
        promotion_discount_percent=0.0,
    )

    assert breakdown.discount_percent == 5.0
    assert breakdown.discount_source == "loyalty"
    assert breakdown.discount_amount == Decimal("10.00")


def test_promotion_only():
    breakdown = calculate_order_discounts(
        Decimal("200.00"),
        loyalty_discount_percent=0.0,
        promotion_discount_percent=20.0,
        applied_promotion_title="Акция",
    )

    assert breakdown.discount_percent == 20.0
    assert breakdown.discount_source == "promotion"
    assert breakdown.discount_amount == Decimal("40.00")
