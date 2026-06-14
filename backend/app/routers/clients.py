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
    ClientLoyaltyProgress,
    ClientLoyaltyRecalculateResponse,
    ClientLoyaltyResponse,
    ClientLoyaltyUpdate,
    ClientOrderSummary,
    ClientSummary,
)
from ..utils.loyalty import (
    get_client_total_spent,
    get_loyalty_progress,
    recalculate_all_clients_loyalty,
    sync_client_loyalty_from_spent,
)
from ..utils.security import log_action

router = APIRouter(prefix="/clients", tags=["clients"])


def _client_loyalty_fields(db: Session, client: Client, *, sync: bool = True) -> dict:
    if sync:
        sync_client_loyalty_from_spent(db, client)
    total_spent = get_client_total_spent(db, client.id)
    progress = get_loyalty_progress(total_spent)
    return {
        "total_spent": float(total_spent),
        "loyalty_progress": ClientLoyaltyProgress(**progress),
    }


def _get_client_for_user(db: Session, user: User) -> Client:
    client = db.query(Client).filter(Client.user_id == user.id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Профиль клиента не найден")
    return client


@router.get("", response_model=ClientListResponse)
async def get_clients(
    search: Optional[str] = Query(None, min_length=1, description="Поиск по имени/email"),
    loyalty_tier: Optional[str] = Query(None, description="Фильтр по уровню лояльности"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query("created_at", description="Поле сортировки"),
    sort_dir: Optional[str] = Query("desc", description="asc|desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить список клиентов с пагинацией и поиском.
    Доступно: manager, admin.
    """
    # Используем inner join с User, чтобы получить только клиентов с существующими пользователями
    query = db.query(Client).join(Client.user).options(
        joinedload(Client.user)
    )

    # Поиск
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
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

    # Сортировка (safe whitelist)
    sort_by = (sort_by or "created_at").lower()
    sort_dir = (sort_dir or "desc").lower()
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="sort_dir должен быть asc или desc")

    from sqlalchemy import literal

    # Expressions for "client name" (User.first_name + ' ' + User.last_name)
    client_name_expr = (
        func.coalesce(User.first_name, "")
        .op("||")(literal(" "))
        .op("||")(func.coalesce(User.last_name, ""))
    )

    sort_map = {
        "client_name": client_name_expr,
        "clinic_name": Client.clinic_name,
        "total_orders": Client.total_orders,
        "loyalty_tier": Client.loyalty_tier,
        "discount_percent": Client.discount_percent,
        "created_at": User.created_at,
    }

    sort_col = sort_map.get(sort_by)
    if sort_col is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимое значение sort_by")

    if sort_dir == "asc":
        order = sort_col.asc().nulls_last() if hasattr(sort_col, "nulls_last") else sort_col.asc()
    else:
        order = sort_col.desc().nulls_last() if hasattr(sort_col, "nulls_last") else sort_col.desc()

    # Пагинация
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    clients = query.order_by(order).offset(offset).limit(limit).all()

    # Формируем ответ
    items = []
    for client in clients:
        # Дополнительная защита от None (хотя inner join должен это предотвратить)
        if not client.user:
            continue
        loyalty = _client_loyalty_fields(db, client)
        items.append(ClientSummary(
            id=client.id,
            user_id=str(client.user.id),
            email=client.user.email,
            first_name=client.user.first_name,
            last_name=client.user.last_name,
            phone=client.user.phone,
            clinic_name=client.clinic_name,
            total_orders=client.total_orders,
            total_spent=loyalty["total_spent"],
            loyalty_tier=client.loyalty_tier,
            discount_percent=client.discount_percent,
            loyalty_points=client.user.loyalty_points,
            created_at=client.user.created_at,
        ))

    db.commit()

    return ClientListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/me/loyalty", response_model=ClientLoyaltyResponse)
async def get_my_loyalty(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["client"])),
):
    """Текущая программа лояльности для авторизованного клиента."""
    client = _get_client_for_user(db, current_user)
    sync_client_loyalty_from_spent(db, client)
    total_spent = get_client_total_spent(db, client.id)
    progress = get_loyalty_progress(total_spent)
    db.commit()

    return ClientLoyaltyResponse(
        total_spent=float(total_spent),
        total_orders=client.total_orders,
        loyalty_tier=client.loyalty_tier,
        discount_percent=client.discount_percent,
        progress=ClientLoyaltyProgress(**progress),
    )


@router.post("/loyalty/recalculate", response_model=ClientLoyaltyRecalculateResponse)
async def recalculate_loyalty_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """Пересчитать скидки всех клиентов по завершённым заказам."""
    count = recalculate_all_clients_loyalty(db)
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="recalculate_loyalty",
        entity_type="client",
        entity_id=None,
        description=f"Пересчитана лояльность для {count} клиентов",
    )
    return ClientLoyaltyRecalculateResponse(updated_clients=count)


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
    client = db.query(Client).join(Client.user).options(
        joinedload(Client.user)
    ).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )

    # Защита от None user
    if not client.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь клиента не найден"
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

    loyalty = _client_loyalty_fields(db, client)
    db.commit()

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
        total_spent=loyalty["total_spent"],
        loyalty_tier=client.loyalty_tier,
        discount_percent=client.discount_percent,
        loyalty_points=client.user.loyalty_points,
        created_at=client.user.created_at,
        loyalty_progress=loyalty["loyalty_progress"],
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
    client = db.query(Client).join(Client.user).options(
        joinedload(Client.user)
    ).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден"
        )

    # Защита от None user
    if not client.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь клиента не найден"
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

    loyalty = _client_loyalty_fields(db, client, sync=False)
    db.commit()

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
        total_spent=loyalty["total_spent"],
        loyalty_tier=client.loyalty_tier,
        discount_percent=client.discount_percent,
        loyalty_points=client.user.loyalty_points,
        created_at=client.user.created_at,
        loyalty_progress=loyalty["loyalty_progress"],
        last_orders=last_orders_summary,
    )
