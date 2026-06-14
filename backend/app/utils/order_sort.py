"""Общая сортировка списка заказов (срочные и просроченные — вверху)."""
from datetime import date

from sqlalchemy import and_, case

from ..models.order import Order, OrderPriority, OrderStatus


def orders_list_order_by(query):
    today = date.today()
    terminal_statuses = [
        OrderStatus.COMPLETED,
        OrderStatus.CANCELLED,
        OrderStatus.ARCHIVED,
    ]
    overdue_rank = case(
        (
            and_(
                Order.deadline.isnot(None),
                Order.deadline < today,
                Order.status.notin_(terminal_statuses),
            ),
            0,
        ),
        else_=1,
    )
    priority_rank = case(
        (Order.priority == OrderPriority.CRITICAL, 0),
        (Order.priority == OrderPriority.URGENT, 1),
        else_=2,
    )
    return query.order_by(
        overdue_rank,
        priority_rank,
        Order.deadline.asc().nullslast(),
        Order.created_at.desc(),
    )
