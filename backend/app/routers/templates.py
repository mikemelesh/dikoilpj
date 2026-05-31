# Routers for order templates.
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..dependencies.auth import get_current_active_user
from ..models.client import Client
from ..models.user import User, UserRole
from ..models.order_template import OrderTemplate
from ..schemas.order import (
    OrderTemplateCreate,
    OrderTemplateResponse,
    OrderTemplateListResponse,
)
from ..utils.security import log_action

router = APIRouter(prefix="/templates", tags=["templates"])


def get_current_client(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.CLIENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only clients can access templates")
    client = db.query(Client).filter(Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client profile not found")
    return client


@router.get("", response_model=OrderTemplateListResponse)
async def list_templates(
    page: int = 1,
    limit: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    query = db.query(OrderTemplate).filter(OrderTemplate.client_id == client.id)
    if search:
        query = query.filter(OrderTemplate.name.ilike(f"%{search}%"))

    total = query.count()
    templates = query.order_by(OrderTemplate.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return OrderTemplateListResponse(
        items=[OrderTemplateResponse.model_validate(t) for t in templates],
        total=total,
        page=page,
        limit=limit,
        pages=(total + limit - 1) // limit
    )


@router.post("", response_model=OrderTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: OrderTemplateCreate,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    template = OrderTemplate(
        client_id=client.id,
        name=data.name,
        items=data.items,
        notes=data.notes,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    log_action(db, str(client.user.id), "create_template", "template", str(template.id), f"Created template {data.name}")
    return OrderTemplateResponse.model_validate(template)


# PUT /templates/{template_id} update
@router.put("/{template_id}", response_model=OrderTemplateResponse)
async def update_template(
    template_id: int,
    data: OrderTemplateCreate,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    template = db.query(OrderTemplate).filter(OrderTemplate.id == template_id, OrderTemplate.client_id == client.id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.name = data.name
    template.items = data.items
    template.notes = data.notes
    db.commit()
    db.refresh(template)
    return OrderTemplateResponse.model_validate(template)


# DELETE /templates/{template_id}
@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    client: Client = Depends(get_current_client),
):
    template = db.query(OrderTemplate).filter(OrderTemplate.id == template_id, OrderTemplate.client_id == client.id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.delete(template)
    db.commit()

