"""
Роутеры для управления техниками.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.order import Order, OrderItem, OrderStatus
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..schemas.clients import (
    TechnicianDetailResponse,
    TechnicianPortfolioResponse,
    TechnicianStatsResponse,
    TechnicianSummary,
    TechnicianUpdate,
)
from ..utils.security import log_action

router = APIRouter(prefix="/technicians", tags=["technicians"])


# =============================================================================
# Публичные маршруты и маршруты текущего пользователя (/me)
# =============================================================================
# ВАЖНО: /me маршруты должны быть ДО /{technician_id} маршрутов!

@router.get("", response_model=list[TechnicianSummary])
async def get_technicians(
    available_only: bool = Query(True, description="Только доступные техники"),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Получить список всех техников.
    Публичный endpoint (для HomePage).
    """
    from ..models.user import User
    
    query = db.query(Technician).join(User)

    if available_only:
        query = query.filter(Technician.is_available == True)

    technicians = query.order_by(Technician.rating.desc()).limit(limit).all()

    items = [
        TechnicianSummary(
            id=tech.id,
            user_id=str(tech.user.id),
            first_name=tech.user.first_name,
            last_name=tech.user.last_name,
            specialization=tech.specialization,
            experience_years=tech.experience_years,
            rating=tech.rating,
            completed_orders=tech.completed_orders,
            is_available=tech.is_available,
        )
        for tech in technicians
    ]

    return items


@router.get("/me", response_model=TechnicianDetailResponse)
async def get_current_technician(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Получить профиль текущего техника.
    Доступно: technician (свой профиль).
    """
    technician = db.query(Technician).options(
        joinedload(Technician.user)
    ).filter(Technician.user_id == current_user.id).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль техника не найден"
        )

    return TechnicianDetailResponse(
        id=technician.id,
        user_id=str(technician.user.id),
        email=technician.user.email,
        first_name=technician.user.first_name,
        last_name=technician.user.last_name,
        phone=technician.user.phone,
        avatar_url=technician.user.avatar_url,
        specialization=technician.specialization,
        experience_years=technician.experience_years,
        rating=technician.rating,
        completed_orders=technician.completed_orders,
        portfolio_description=technician.portfolio_description,
        is_available=technician.is_available,
        created_at=technician.user.created_at,
        updated_at=technician.user.updated_at,
    )


@router.get("/me/stats", response_model=TechnicianStatsResponse)
async def get_current_technician_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Получить статистику текущего техника.
    Доступно: technician (своя статистика).
    """
    technician = db.query(Technician).filter(
        Technician.user_id == current_user.id
    ).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль техника не найден"
        )

    # Общее количество заказов
    total_orders = db.query(Order).filter(
        Order.technician_id == technician.id
    ).count()

    # Выполненные заказы
    completed_orders = db.query(Order).filter(
        Order.technician_id == technician.id,
        Order.status == OrderStatus.COMPLETED
    ).count()

    # Заказы в работе
    in_progress_orders = db.query(Order).filter(
        Order.technician_id == technician.id,
        Order.status == OrderStatus.IN_PROGRESS
    ).count()

    # Среднее время выполнения (в днях)
    avg_completion = db.query(
        func.avg(
            func.extract('epoch', Order.completed_at) -
            func.extract('epoch', Order.created_at)
        ) / 86400
    ).filter(
        Order.technician_id == technician.id,
        Order.status == OrderStatus.COMPLETED,
        Order.completed_at.isnot(None)
    ).scalar()

    # Общий заработок (сумма final_price выполненных заказов)
    total_earnings = db.query(
        func.sum(Order.final_price)
    ).filter(
        Order.technician_id == technician.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or Decimal('0')

    # Заказы по месяцам (последние 6 месяцев)
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    monthly_data = db.query(
        func.date_trunc('month', Order.completed_at).label('month'),
        func.count(Order.id).label('count')
    ).filter(
        Order.technician_id == technician.id,
        Order.status == OrderStatus.COMPLETED,
        Order.completed_at >= six_months_ago,
        Order.completed_at.isnot(None)
    ).group_by('month').order_by('month').all()

    monthly_completed = []
    for row in monthly_data:
        if row.month:
            month_str = str(row.month)
            # Извлекаем YYYY-MM из datetime
            if ' ' in month_str:
                month_str = month_str.split(' ')[0]
            monthly_completed.append({"month": month_str[:7], "count": int(row.count) if row.count else 0})

    return TechnicianStatsResponse(
        total_orders=int(total_orders) if total_orders is not None else 0,
        completed_orders=int(completed_orders) if completed_orders is not None else 0,
        in_progress_orders=int(in_progress_orders) if in_progress_orders is not None else 0,
        average_completion_days=float(avg_completion) if avg_completion is not None else None,
        rating=float(technician.rating) if technician.rating is not None else 0.0,
        total_earnings=float(total_earnings) if total_earnings is not None else 0.0,
        monthly_completed=monthly_completed,
    )


@router.get("/me/orders")
async def get_current_technician_orders(
    status_filter: Optional[list[str]] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Получить заказы текущего техника.
    Доступно: technician (свои заказы).
    """
    from sqlalchemy.orm import joinedload
    from ..models.client import Client
    from ..models.technician import Technician
    from ..models.order import OrderItem
    from ..models.service import Service

    technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль техника не найден"
        )

    query = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.files),
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician),
    ).filter(Order.technician_id == technician.id)

    # Поддержка множественных статусов
    if status_filter:
        query = query.filter(Order.status.in_(status_filter))

    total = query.count()
    offset = (page - 1) * limit
    orders = query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()

    # Загружаем услуги отдельно
    service_ids = set()
    for order in orders:
        for item in order.items:
            service_ids.add(item.service_id)

    services = {s.id: s for s in db.query(Service).filter(Service.id.in_(service_ids)).all()} if service_ids else {}

    items = [
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "status": order.status.value,
            "priority": order.priority.value,
            "final_price": float(order.final_price),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "deadline": order.deadline.isoformat() if order.deadline else None,
            "items": [
                {
                    "service_id": item.service_id,
                    "service_name": services.get(item.service_id).name if services.get(item.service_id) else "Unknown",
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                }
                for item in order.items
            ],
            "client": {
                "clinic_name": order.client.clinic_name if order.client else None,
            } if order.client else None,
        }
        for order in orders
    ]

    return {"items": items, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit if total > 0 else 0}


@router.put("/me/profile", response_model=TechnicianDetailResponse)
async def update_technician_profile(
    profile_data: TechnicianUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Обновить профиль техника.
    Доступно: только technician (свой профиль).
    """
    technician = db.query(Technician).options(
        joinedload(Technician.user)
    ).filter(Technician.user_id == current_user.id).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль техника не найден"
        )

    update_data = profile_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(technician, field, value)

    db.add(technician)
    db.commit()
    db.refresh(technician)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_technician_profile",
        entity_type="technician",
        entity_id=str(technician.id),
        description="Обновлен профиль техника",
    )

    return TechnicianDetailResponse(
        id=technician.id,
        user_id=str(technician.user.id),
        email=technician.user.email,
        first_name=technician.user.first_name,
        last_name=technician.user.last_name,
        phone=technician.user.phone,
        avatar_url=technician.user.avatar_url,
        specialization=technician.specialization,
        experience_years=technician.experience_years,
        rating=technician.rating,
        completed_orders=technician.completed_orders,
        portfolio_description=technician.portfolio_description,
        is_available=technician.is_available,
        created_at=technician.user.created_at,
        updated_at=technician.user.updated_at,
    )


# =============================================================================
# Маршруты для работы с конкретным техниником по ID (/{technician_id})
# =============================================================================

@router.get("/{technician_id}", response_model=TechnicianDetailResponse)
async def get_technician(
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить детальную информацию о технике.
    Доступно: manager, admin.
    """
    technician = db.query(Technician).options(
        joinedload(Technician.user)
    ).filter(Technician.id == technician_id).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Техник не найден"
        )

    return TechnicianDetailResponse(
        id=technician.id,
        user_id=str(technician.user.id),
        email=technician.user.email,
        first_name=technician.user.first_name,
        last_name=technician.user.last_name,
        phone=technician.user.phone,
        avatar_url=technician.user.avatar_url,
        specialization=technician.specialization,
        experience_years=technician.experience_years,
        rating=technician.rating,
        completed_orders=technician.completed_orders,
        portfolio_description=technician.portfolio_description,
        is_available=technician.is_available,
        created_at=technician.user.created_at,
    )


@router.get("/{technician_id}/stats", response_model=TechnicianStatsResponse)
async def get_technician_stats(
    technician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin", "technician"])),
):
    """
    Получить статистику техника.
    Доступно: manager, admin, technician (только свою).
    """
    # Проверка прав: техник может смотреть только свою статистику
    if current_user.role == UserRole.TECHNICIAN:
        technician_profile = db.query(Technician).filter(
            Technician.user_id == current_user.id
        ).first()
        if not technician_profile or technician_profile.id != technician_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещён"
            )

    technician = db.query(Technician).filter(Technician.id == technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Техник не найден"
        )

    # Статистика по заказам
    total_orders = db.query(func.count(Order.id)).filter(
        Order.technician_id == technician_id
    ).scalar() or 0

    completed_orders = db.query(func.count(Order.id)).filter(
        Order.technician_id == technician_id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0

    in_progress_orders = db.query(func.count(Order.id)).filter(
        Order.technician_id == technician_id,
        Order.status == OrderStatus.IN_PROGRESS
    ).scalar() or 0

    # Среднее время выполнения (в днях)
    avg_completion = db.query(
        func.avg(
            func.extract('epoch', Order.completed_at) -
            func.extract('epoch', Order.created_at)
        ) / 86400  # Перевод секунд в дни
    ).filter(
        Order.technician_id == technician_id,
        Order.status == OrderStatus.COMPLETED,
        Order.completed_at.isnot(None)
    ).scalar()

    # Общая сумма заработанных средств
    total_earnings = db.query(
        func.sum(Order.final_price)
    ).filter(
        Order.technician_id == technician_id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or Decimal("0.00")

    return TechnicianStatsResponse(
        total_orders=int(total_orders) if total_orders is not None else 0,
        completed_orders=int(completed_orders) if completed_orders is not None else 0,
        in_progress_orders=int(in_progress_orders) if in_progress_orders is not None else 0,
        average_completion_days=float(avg_completion) if avg_completion is not None else None,
        rating=float(technician.rating) if technician.rating is not None else 0.0,
        total_earnings=float(total_earnings) if total_earnings is not None else 0.0,
        monthly_completed=[],
    )


@router.get("/{technician_id}/portfolio", response_model=TechnicianPortfolioResponse)
async def get_technician_portfolio(
    technician_id: int,
    db: Session = Depends(get_db),
):
    """
    Получить портфолио техника.
    Публичный эндпоинт.
    """
    technician = db.query(Technician).options(
        joinedload(Technician.user)
    ).filter(Technician.id == technician_id).first()

    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Техник не найден"
        )

    # Последние выполненные работы (5 заказов)
    recent_works = db.query(Order).filter(
        Order.technician_id == technician_id,
        Order.status == OrderStatus.COMPLETED
    ).order_by(Order.completed_at.desc()).limit(5).all()

    recent_works_data = [
        {
            "order_number": order.order_number,
            "completed_at": order.completed_at.isoformat() if order.completed_at else None,
            "final_price": float(order.final_price),
            "items_count": len(order.items),
        }
        for order in recent_works
    ]

    return TechnicianPortfolioResponse(
        id=technician.id,
        first_name=technician.user.first_name,
        last_name=technician.user.last_name,
        specialization=technician.specialization,
        experience_years=technician.experience_years,
        rating=technician.rating,
        completed_orders=technician.completed_orders,
        portfolio_description=technician.portfolio_description,
        recent_works=recent_works_data,
    )
