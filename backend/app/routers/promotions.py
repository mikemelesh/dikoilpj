"""
Роутеры для акций.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.promotion import Promotion, PromotionAppliesTo
from ..models.user import User
from ..schemas.secondary import (
    PromotionCreate,
    PromotionListResponse,
    PromotionResponse,
    PromotionUpdate,
)
from ..utils.security import log_action

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("", response_model=PromotionListResponse)
async def get_promotions(
    db: Session = Depends(get_db),
):
    """
    Получить список активных акций.
    Публичный эндпоинт.
    """
    today = date.today()
    promotions = db.query(Promotion).filter(
        Promotion.is_active == True,
        Promotion.start_date <= today,
        Promotion.end_date >= today,
    ).order_by(Promotion.start_date.desc()).all()
    
    items = [
        PromotionResponse(
            id=p.id,
            title=p.title,
            description=p.description,
            discount_percent=p.discount_percent,
            start_date=p.start_date,
            end_date=p.end_date,
            is_active=p.is_active,
            applies_to=p.applies_to.value,
            target_id=p.target_id,
        )
        for p in promotions
    ]
    
    return PromotionListResponse(items=items, total=len(items))


@router.post("", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    promotion_data: PromotionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Создать акцию.
    Доступно: manager, admin.
    """
    # Валидация дат
    if promotion_data.end_date < promotion_data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата окончания должна быть позже даты начала"
        )
    
    # Валидация applies_to
    applies_to = promotion_data.applies_to.lower()
    if applies_to not in ["all", "service", "category"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="applies_to должен быть 'all', 'service' или 'category'"
        )
    
    # Если не 'all', то target_id обязателен
    if applies_to != "all" and promotion_data.target_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="target_id обязателен для service/category"
        )
    
    db_promotion = Promotion(
        title=promotion_data.title,
        description=promotion_data.description,
        discount_percent=promotion_data.discount_percent,
        start_date=promotion_data.start_date,
        end_date=promotion_data.end_date,
        is_active=promotion_data.is_active,
        applies_to=PromotionAppliesTo(applies_to),
        target_id=promotion_data.target_id,
    )
    db.add(db_promotion)
    db.commit()
    db.refresh(db_promotion)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_promotion",
        entity_type="promotion",
        entity_id=str(db_promotion.id),
        description=f"Создана акция {db_promotion.title}",
    )
    
    return PromotionResponse(
        id=db_promotion.id,
        title=db_promotion.title,
        description=db_promotion.description,
        discount_percent=db_promotion.discount_percent,
        start_date=db_promotion.start_date,
        end_date=db_promotion.end_date,
        is_active=db_promotion.is_active,
        applies_to=db_promotion.applies_to.value,
        target_id=db_promotion.target_id,
    )


@router.put("/{promotion_id}", response_model=PromotionResponse)
async def update_promotion(
    promotion_id: int,
    promotion_data: PromotionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить акцию.
    Доступно: manager, admin.
    """
    promotion = db.query(Promotion).filter(Promotion.id == promotion_id).first()
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Акция не найдена"
        )
    
    update_data = promotion_data.model_dump(exclude_unset=True)
    
    # Валидация дат
    if "start_date" in update_data or "end_date" in update_data:
        start = update_data.get("start_date", promotion.start_date)
        end = update_data.get("end_date", promotion.end_date)
        if end < start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Дата окончания должна быть позже даты начала"
            )
    
    # Валидация applies_to
    if "applies_to" in update_data:
        applies_to = update_data["applies_to"].lower() if update_data["applies_to"] else None
        if applies_to and applies_to not in ["all", "service", "category"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="applies_to должен быть 'all', 'service' или 'category'"
            )
        if applies_to:
            update_data["applies_to"] = PromotionAppliesTo(applies_to)
    
    for field, value in update_data.items():
        setattr(promotion, field, value)
    
    db.add(promotion)
    db.commit()
    db.refresh(promotion)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_promotion",
        entity_type="promotion",
        entity_id=str(promotion_id),
        description=f"Обновлена акция {promotion.title}",
    )
    
    return PromotionResponse(
        id=promotion.id,
        title=promotion.title,
        description=promotion.description,
        discount_percent=promotion.discount_percent,
        start_date=promotion.start_date,
        end_date=promotion.end_date,
        is_active=promotion.is_active,
        applies_to=promotion.applies_to.value,
        target_id=promotion.target_id,
    )


@router.delete("/{promotion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promotion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Удалить акцию.
    Доступно: manager, admin.
    """
    promotion = db.query(Promotion).filter(Promotion.id == promotion_id).first()
    if not promotion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Акция не найдена"
        )
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="delete_promotion",
        entity_type="promotion",
        entity_id=str(promotion_id),
        description=f"Удалена акция {promotion.title}",
    )
    
    db.delete(promotion)
    db.commit()
    
    return None
