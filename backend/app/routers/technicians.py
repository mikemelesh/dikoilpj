"""
Роутеры для управления техниками.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.order import Order, OrderStatus
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


@router.get("", response_model=list[TechnicianSummary])
async def get_technicians(
    available_only: bool = Query(True, description="Только доступные техники"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить список всех техников.
    Доступно: manager, admin.
    """
    query = db.query(Technician).options(
        joinedload(Technician.user)
    )
    
    if available_only:
        query = query.filter(Technician.is_available == True)
    
    technicians = query.order_by(Technician.rating.desc()).all()
    
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
        total_orders=total_orders,
        completed_orders=completed_orders,
        in_progress_orders=in_progress_orders,
        average_completion_days=float(avg_completion) if avg_completion else None,
        rating=technician.rating,
        total_earnings=total_earnings,
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
        description="Профиль техника обновлён",
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
