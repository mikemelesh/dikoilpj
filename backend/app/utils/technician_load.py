"""Technician daily workload (active assigned orders)."""
from typing import Dict, Iterable, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.order import Order, OrderStatus

MAX_TECHNICIAN_ACTIVE_ORDERS = 4

# Active pipeline counts toward load (assigned, not yet completed).
ACTIVE_LOAD_STATUSES = (
    OrderStatus.CONFIRMED,
    OrderStatus.IN_PROGRESS,
    OrderStatus.REVIEW,
)


def count_technician_active_orders(
    db: Session,
    technician_id: int,
    *,
    exclude_order_id: Optional[str] = None,
) -> int:
    query = db.query(func.count(Order.id)).filter(
        Order.technician_id == technician_id,
        Order.status.in_(ACTIVE_LOAD_STATUSES),
    )
    if exclude_order_id is not None:
        query = query.filter(Order.id != exclude_order_id)
    return int(query.scalar() or 0)


def get_technician_load_map(db: Session, technician_ids: Optional[Iterable[int]] = None) -> Dict[int, int]:
    query = (
        db.query(Order.technician_id, func.count(Order.id))
        .filter(
            Order.technician_id.isnot(None),
            Order.status.in_(ACTIVE_LOAD_STATUSES),
        )
        .group_by(Order.technician_id)
    )
    if technician_ids is not None:
        ids = list(technician_ids)
        if not ids:
            return {}
        query = query.filter(Order.technician_id.in_(ids))

    return {int(tech_id): int(count) for tech_id, count in query.all()}


def assert_technician_can_take_order(
    db: Session,
    technician_id: int,
    *,
    exclude_order_id: Optional[str] = None,
) -> None:
    load = count_technician_active_orders(
        db, technician_id, exclude_order_id=exclude_order_id
    )
    if load >= MAX_TECHNICIAN_ACTIVE_ORDERS:
        raise ValueError(
            f"У техника максимальная загрузка ({MAX_TECHNICIAN_ACTIVE_ORDERS} активных заказа)"
        )
