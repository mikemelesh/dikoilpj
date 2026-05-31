"""
Роутеры для управления FAQ.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.faq import Faq
from ..models.user import User, UserRole
from ..schemas.faq import FaqCreate, FaqResponse, FaqUpdate
from ..utils.security import log_action

router = APIRouter(prefix="/faq", tags=["faq"])


# =============================================================================
# Список FAQ
# =============================================================================


@router.get("", response_model=list[FaqResponse])
async def get_faq_list(
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    sort_by: Optional[str] = Query(
        "sort_order",
        description="Поле сортировки: sort_order|question|category|is_published|created_at",
    ),
    sort_dir: Optional[str] = Query(
        "asc",
        description="Направление сортировки: asc|desc",
    ),
    db: Session = Depends(get_db),
):
    """
    Получить список FAQ.
    Доступно: всем (публичный endpoint).
    """
    query = db.query(Faq).filter(Faq.is_published == True)
    
    if category:
        query = query.filter(Faq.category == category)

    sort_by = (sort_by or "sort_order").lower()
    sort_dir = (sort_dir or "asc").lower()
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_dir должен быть asc или desc",
        )

    sort_map = {
        "sort_order": Faq.sort_order,
        "question": Faq.question,
        "category": Faq.category,
        "is_published": Faq.is_published,
        "created_at": Faq.created_at,
    }
    sort_col = sort_map.get(sort_by)
    if sort_col is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимое значение sort_by",
        )

    order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

    # deterministic secondary sort
    query = query.order_by(order, Faq.created_at.desc())

    return query.all()


# =============================================================================
# Создание FAQ
# =============================================================================


@router.post("", response_model=FaqResponse, status_code=status.HTTP_201_CREATED)
async def create_faq(
    faq_data: FaqCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Создать новый FAQ.
    Доступно: admin, manager.
    """
    faq = Faq(
        question=faq_data.question,
        answer=faq_data.answer,
        category=faq_data.category,
        sort_order=faq_data.sort_order,
        is_published=faq_data.is_published,
    )
    db.add(faq)
    db.commit()
    db.refresh(faq)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_faq",
        entity_type="faq",
        entity_id=str(faq.id),
        description=f"Создан FAQ: {faq.question[:50]}",
    )

    return faq


# =============================================================================
# Обновление FAQ
# =============================================================================


@router.put("/{faq_id}", response_model=FaqResponse)
async def update_faq(
    faq_id: int,
    faq_data: FaqUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Обновить FAQ.
    Доступно: admin, manager.
    """
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ не найден"
        )

    update_data = faq_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(faq, field, value)

    db.commit()
    db.refresh(faq)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_faq",
        entity_type="faq",
        entity_id=str(faq_id),
        description=f"Обновлён FAQ: {faq.question[:50]}",
    )

    return faq


# =============================================================================
# Удаление FAQ
# =============================================================================


@router.delete("/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faq(
    faq_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Удалить FAQ.
    Доступно: admin, manager.
    """
    faq = db.query(Faq).filter(Faq.id == faq_id).first()
    if not faq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FAQ не найден"
        )

    db.delete(faq)
    db.commit()

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="delete_faq",
        entity_type="faq",
        entity_id=str(faq_id),
        description=f"Удалён FAQ: {faq.question[:50]}",
    )

    return None
