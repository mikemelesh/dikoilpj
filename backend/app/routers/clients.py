"""
Роутеры для управления клиентами.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.client import Client
from ..models.order import Order, OrderStatus
from ..models.user import User, UserRole
from ..schemas.clients import (
    ClientDetailResponse,
    ClientListResponse,
    ClientLoyaltyUpdate,
    ClientOrderSummary,
    ClientSummary,
)
from ..utils.security import log_action

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=ClientListResponse)
async def get_clients(
    search: Optional[str] = Query(None, min_length=1, description="Поиск по имени/email"),
    loyalty_tier: Optional[str] = Query(None, description="Фильтр по уровню лояльности"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить список клиентов с пагинацией и поиском.
    Доступно: manager, admin.
    """
    query = db.query(Client).options(
        joinedload(Client.user)
    )
    
    # Поиск
    if search:
        search_pattern = f"%{search}%"
        query = query.join(Client.user).filter(
            or_(
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
                User.email.ilike(search_pattern),
                Client.clinic_name.ilike(search_pattern),
            )
        )
    
    # Фильтр по уровню лояльности
    if loyalty_tier:
        valid_tiers = ["bronze", "silver", "gold", "platinum"]
        if loyalty_tier.lower() not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый уровень лояльности. Допустимые: {', '.join(valid_tiers)}"
            )
        query = query.filter(Client.loyalty_tier == loyalty_tier.lower())
    
    # Пагинация
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    clients = query.order_by(Client.total_orders.desc()).offset(offset).limit(limit).all()
    
    # Формируем ответ
    items = []
    for client in clients:
        items.append(ClientSummary(
            id=client.id,
            user_id=str(client.user.id),
            email=client.user.email,
            first_name=client.user.first_name,
            last_name=client.user.last_name,
            phone=client.user.phone,
            clinic_name=client.clinic_name,
            total_orders=client.total_orders,
            loyalty_tier=client.loyalty_tier,
            discount_percent=client.discount_percent,
            loyalty_points=client.user.loyalty_points,
        ))
    
    return ClientListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{client_id}", response_model=ClientDetailResponse)
async def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить детальную информацию о клиенте + последние 10 заказов.
    Доступно: manager, admin.
    """
    client = db.query(Client).options(
        joinedload(Client.user)
    ).filter(Client.id == client_id).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )
    
    # Последние 10 заказов
    last_orders = db.query(Order).filter(
        Order.client_id == client_id
    ).order_by(Order.created_at.desc()).limit(10).all()
    
    last_orders_summary = [
        ClientOrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            status=order.status,
            final_price=order.final_price,
            created_at=order.created_at,
        )
        for order in last_orders
    ]
    
    return ClientDetailResponse(
        id=client.id,
        user_id=str(client.user.id),
        email=client.user.email,
        first_name=client.user.first_name,
        last_name=client.user.last_name,
        phone=client.user.phone,
        clinic_name=client.clinic_name,
        address=client.address,
        total_orders=client.total_orders,
        loyalty_tier=client.loyalty_tier,
        discount_percent=client.discount_percent,
        loyalty_points=client.user.loyalty_points,
        created_at=client.user.created_at,
        last_orders=last_orders_summary,
    )


@router.put("/{client_id}/loyalty", response_model=ClientDetailResponse)
async def update_client_loyalty(
    client_id: int,
    loyalty_data: ClientLoyaltyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить программу лояльности клиента (tier и discount_percent).
    Доступно: manager, admin.
    """
    client = db.query(Client).options(
        joinedload(Client.user)
    ).filter(Client.id == client_id).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )
    
    update_data = loyalty_data.model_dump(exclude_unset=True)
    
    if "discount_percent" in update_data and update_data["discount_percent"] is not None:
        client.discount_percent = update_data["discount_percent"]
    
    if "loyalty_tier" in update_data and update_data["loyalty_tier"] is not None:
        valid_tiers = ["bronze", "silver", "gold", "platinum"]
        if update_data["loyalty_tier"].lower() not in valid_tiers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый уровень лояльности. Допустимые: {', '.join(valid_tiers)}"
            )
        client.loyalty_tier = update_data["loyalty_tier"].lower()
    
    db.add(client)
    db.commit()
    db.refresh(client)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_client_loyalty",
        entity_type="client",
        entity_id=str(client.id),
        description=f"Обновлена программа лояльности для клиента {client.user.email}",
    )
    
    # Последние 10 заказов
    last_orders = db.query(Order).filter(
        Order.client_id == client_id
    ).order_by(Order.created_at.desc()).limit(10).all()
    
    last_orders_summary = [
        ClientOrderSummary(
            id=str(order.id),
            order_number=order.order_number,
            status=order.status,
            final_price=order.final_price,
            created_at=order.created_at,
        )
        for order in last_orders
    ]
    
    return ClientDetailResponse(
        id=client.id,
        user_id=str(client.user.id),
        email=client.user.email,
        first_name=client.user.first_name,
        last_name=client.user.last_name,
        phone=client.user.phone,
        clinic_name=client.clinic_name,
        address=client.address,
        total_orders=client.total_orders,
        loyalty_tier=client.loyalty_tier,
        discount_percent=client.discount_percent,
        loyalty_points=client.user.loyalty_points,
        created_at=client.user.created_at,
        last_orders=last_orders_summary,
    )
