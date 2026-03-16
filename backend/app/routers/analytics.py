"""
Роутеры для аналитики.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.order import Order, OrderPriority, OrderStatus
from ..models.service import Service, ServiceCategory
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..schemas.secondary import (
    OrderAnalyticsResponse,
    RevenueAnalyticsResponse,
    RevenueByCategory,
    RevenueByPeriod,
    TechnicianAnalyticsItem,
    TechnicianAnalyticsResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/orders", response_model=OrderAnalyticsResponse)
async def get_order_analytics(
    date_from: date = Query(..., description="Дата начала"),
    date_to: date = Query(..., description="Дата окончания"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Аналитика заказов за период.
    Доступно: manager, admin.
    """
    if date_to < date_from:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date_to должна быть позже date_from"
        )
    
    # Добавляем 1 день к date_to для включения последнего дня
    date_to_end = datetime.combine(date_to, datetime.max.time())
    date_from_start = datetime.combine(date_from, datetime.min.time())
    
    # Базовый запрос
    base_query = db.query(Order).filter(
        Order.created_at >= date_from_start,
        Order.created_at <= date_to_end,
    )
    
    # Всего заказов
    total = base_query.count()
    
    # По статусам
    by_status: Dict[str, int] = {}
    for s in OrderStatus:
        count = base_query.filter(Order.status == s).count()
        by_status[s.value] = count
    
    # По приоритетам
    by_priority: Dict[str, int] = {}
    for p in OrderPriority:
        count = base_query.filter(Order.priority == p).count()
        by_priority[p.value] = count
    
    # Среднее время выполнения (для завершённых)
    avg_completion = db.query(
        func.avg(
            func.extract('epoch', Order.completed_at) - 
            func.extract('epoch', Order.created_at)
        ) / 86400  # Перевод секунд в дни
    ).filter(
        Order.created_at >= date_from_start,
        Order.created_at <= date_to_end,
        Order.status == OrderStatus.COMPLETED,
        Order.completed_at.isnot(None)
    ).scalar()
    
    return OrderAnalyticsResponse(
        total=total,
        by_status=by_status,
        by_priority=by_priority,
        avg_completion_days=float(avg_completion) if avg_completion else None,
    )


@router.get("/revenue", response_model=RevenueAnalyticsResponse)
async def get_revenue_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Аналитика доходов.
    Доступно: manager, admin.
    """
    # Общая выручка (завершённые заказы)
    total = db.query(
        func.sum(Order.final_price)
    ).filter(
        Order.status == OrderStatus.COMPLETED
    ).scalar() or Decimal("0.00")
    
    # По периодам (по месяцам за последний год)
    by_period = []
    today = date.today()
    for i in range(12):
        month_start = today - timedelta(days=30 * i)
        month_end = month_start + timedelta(days=30)
        
        amount = db.query(
            func.sum(Order.final_price)
        ).filter(
            Order.status == OrderStatus.COMPLETED,
            Order.completed_at >= datetime.combine(month_start, datetime.min.time()),
            Order.completed_at <= datetime.combine(month_end, datetime.max.time()),
        ).scalar() or Decimal("0.00")
        
        by_period.append(RevenueByPeriod(
            date=month_start.strftime("%Y-%m"),
            amount=amount,
        ))
    
    by_period.reverse()
    
    # По категориям услуг
    by_category = []
    categories = db.query(
        ServiceCategory.id,
        ServiceCategory.name,
        func.sum(OrderItem.total_price).label("total")
    ).join(
        Service, Service.category_id == ServiceCategory.id
    ).join(
        OrderItem, OrderItem.service_id == Service.id
    ).join(
        Order, Order.id == OrderItem.order_id
    ).filter(
        Order.status == OrderStatus.COMPLETED
    ).group_by(
        ServiceCategory.id,
        ServiceCategory.name,
    ).all()
    
    by_category = [
        RevenueByCategory(
            category_id=c.id,
            category_name=c.name,
            total=c.total or Decimal("0.00"),
        )
        for c in categories
    ]
    
    return RevenueAnalyticsResponse(
        total=total,
        by_period=by_period,
        by_service_category=by_category,
    )


@router.get("/technicians", response_model=TechnicianAnalyticsResponse)
async def get_technician_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Аналитика по техникам.
    Доступно: manager, admin.
    """
    technicians = db.query(Technician).join(Technician.user).all()
    
    items = []
    for tech in technicians:
        # Завершённые заказы
        completed = db.query(func.count(Order.id)).filter(
            Order.technician_id == tech.id,
            Order.status == OrderStatus.COMPLETED,
        ).scalar() or 0
        
        # Среднее время выполнения
        avg_days = db.query(
            func.avg(
                func.extract('epoch', Order.completed_at) - 
                func.extract('epoch', Order.created_at)
            ) / 86400
        ).filter(
            Order.technician_id == tech.id,
            Order.status == OrderStatus.COMPLETED,
            Order.completed_at.isnot(None),
        ).scalar()
        
        # Процент вовремя (deadline)
        total_with_deadline = db.query(func.count(Order.id)).filter(
            Order.technician_id == tech.id,
            Order.status == OrderStatus.COMPLETED,
            Order.deadline.isnot(None),
        ).scalar() or 0
        
        on_time = db.query(func.count(Order.id)).filter(
            Order.technician_id == tech.id,
            Order.status == OrderStatus.COMPLETED,
            Order.deadline.isnot(None),
            Order.completed_at <= Order.deadline,
        ).scalar() or 0
        
        on_time_percent = (on_time / total_with_deadline * 100) if total_with_deadline > 0 else 100.0
        
        items.append(TechnicianAnalyticsItem(
            technician_id=tech.id,
            technician_name=f"{tech.user.first_name} {tech.user.last_name}",
            completed=completed,
            avg_days=float(avg_days) if avg_days else None,
            rating=tech.rating,
            on_time_percent=round(on_time_percent, 1),
        ))
    
    return TechnicianAnalyticsResponse(items=items, total=len(items))


# Импортируем OrderItem для revenue analytics
from ..models.order import OrderItem  # noqa: E402
