# Routers for order templates.
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user
from ..models.client import Client
from ..models.service import Service
from ..models.user import User, UserRole
from ..models.order_template import OrderTemplate
from ..schemas.order import (
    OrderTemplateCreate,
    OrderTemplateResponse,
    OrderTemplateListResponse,
)
from ..utils.security import log_action

router = APIRouter(prefix="/templates", tags=["templates"])


def _serialize_items(items: list) -> list[dict]:
    normalized: list[dict] = []
    for item in items:
        if isinstance(item, dict):
            normalized.append(
                {
                    "service_id": int(item["service_id"]),
                    "quantity": int(item.get("quantity") or 1),
                    **({"service_name": item["service_name"]} if item.get("service_name") else {}),
                    **({"specifications": item["specifications"]} if item.get("specifications") else {}),
                }
            )
        else:
            normalized.append(item.model_dump())
    return normalized


def _validate_template_services(db: Session, items: list) -> list[dict]:
    serialized = _serialize_items(items)
    service_ids = {item["service_id"] for item in serialized}
    services = {
        service.id: service
        for service in db.query(Service).filter(Service.id.in_(service_ids)).all()
    }

    missing = service_ids - set(services.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Услуги не найдены: {', '.join(str(service_id) for service_id in sorted(missing))}",
        )

    for item in serialized:
        service = services[item["service_id"]]
        if not service.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Услуга «{service.name}» неактивна",
            )
        item.setdefault("service_name", service.name)
    return serialized


def _resolve_target_client(
    db: Session,
    current_user: User,
    client_id: Optional[int],
) -> Client:
    if current_user.role == UserRole.CLIENT:
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Профиль клиента не найден",
            )
        if client_id is not None and client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нельзя управлять шаблонами другого клиента",
            )
        return client

    if current_user.role not in {UserRole.MANAGER, UserRole.ADMIN}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для работы с шаблонами",
        )

    if client_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите client_id клиента",
        )

    client = (
        db.query(Client)
        .options(joinedload(Client.user))
        .filter(Client.id == client_id)
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    return client


def _template_response(template: OrderTemplate) -> OrderTemplateResponse:
    client_name = None
    if template.client and template.client.user:
        client_name = f"{template.client.user.first_name} {template.client.user.last_name}".strip()
    elif template.client and template.client.clinic_name:
        client_name = template.client.clinic_name

    return OrderTemplateResponse(
        id=template.id,
        client_id=template.client_id,
        client_name=client_name,
        name=template.name,
        items=template.items,
        notes=template.notes,
        created_at=template.created_at,
    )


def _get_template_for_user(
    db: Session,
    template_id: int,
    current_user: User,
    client_id: Optional[int] = None,
) -> OrderTemplate:
    query = (
        db.query(OrderTemplate)
        .options(joinedload(OrderTemplate.client).joinedload(Client.user))
        .filter(OrderTemplate.id == template_id)
    )

    if current_user.role == UserRole.CLIENT:
        client = _resolve_target_client(db, current_user, None)
        query = query.filter(OrderTemplate.client_id == client.id)
    elif client_id is not None:
        query = query.filter(OrderTemplate.client_id == client_id)

    template = query.first()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон не найден",
        )
    return template


@router.get("", response_model=OrderTemplateListResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Поиск по названию"),
    client_id: Optional[int] = Query(None, gt=0, description="Фильтр по клиенту (manager/admin)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Список шаблонов заказов.
    Клиент видит только свои; manager/admin — все или по client_id.
    """
    query = db.query(OrderTemplate).options(
        joinedload(OrderTemplate.client).joinedload(Client.user)
    )

    if current_user.role == UserRole.CLIENT:
        client = _resolve_target_client(db, current_user, None)
        query = query.filter(OrderTemplate.client_id == client.id)
    elif current_user.role in {UserRole.MANAGER, UserRole.ADMIN}:
        if client_id is not None:
            query = query.filter(OrderTemplate.client_id == client_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра шаблонов",
        )

    if search:
        query = query.filter(OrderTemplate.name.ilike(f"%{search}%"))

    total = query.count()
    templates = (
        query.order_by(OrderTemplate.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return OrderTemplateListResponse(
        items=[_template_response(template) for template in templates],
        total=total,
        page=page,
        limit=limit,
        pages=(total + limit - 1) // limit if total else 0,
    )


@router.post("", response_model=OrderTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: OrderTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Создать шаблон заказа. Manager/admin указывают client_id."""
    client = _resolve_target_client(db, current_user, data.client_id)
    items = _validate_template_services(db, data.items)

    template = OrderTemplate(
        client_id=client.id,
        name=data.name.strip(),
        items=items,
        notes=data.notes,
    )
    db.add(template)
    db.commit()
    db.refresh(template)

    template = (
        db.query(OrderTemplate)
        .options(joinedload(OrderTemplate.client).joinedload(Client.user))
        .filter(OrderTemplate.id == template.id)
        .first()
    )

    log_action(
        db,
        user_id=str(current_user.id),
        action_type="create_template",
        entity_type="template",
        entity_id=str(template.id),
        description=f"Создан шаблон «{data.name}» для клиента #{client.id}",
    )

    return _template_response(template)


@router.put("/{template_id}", response_model=OrderTemplateResponse)
async def update_template(
    template_id: int,
    data: OrderTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Обновить шаблон заказа."""
    client = _resolve_target_client(db, current_user, data.client_id)
    template = _get_template_for_user(db, template_id, current_user, client.id)

    if current_user.role == UserRole.CLIENT and template.client_id != client.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нельзя изменить чужой шаблон")

    items = _validate_template_services(db, data.items)
    template.name = data.name.strip()
    template.items = items
    template.notes = data.notes
    db.commit()
    db.refresh(template)

    template = (
        db.query(OrderTemplate)
        .options(joinedload(OrderTemplate.client).joinedload(Client.user))
        .filter(OrderTemplate.id == template.id)
        .first()
    )
    return _template_response(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    client_id: Optional[int] = Query(None, gt=0, description="ID клиента (manager/admin)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Удалить шаблон заказа."""
    if current_user.role == UserRole.CLIENT:
        client = _resolve_target_client(db, current_user, None)
        template = _get_template_for_user(db, template_id, current_user, client.id)
    else:
        if client_id is None:
            template = _get_template_for_user(db, template_id, current_user)
        else:
            _resolve_target_client(db, current_user, client_id)
            template = _get_template_for_user(db, template_id, current_user, client_id)

    db.delete(template)
    db.commit()
