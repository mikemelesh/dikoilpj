"""
Роутеры для отзывов.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.client import Client
from ..models.order import Order
from ..models.review import Review
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..schemas.secondary import (
    ReviewCreate,
    ReviewListResponse,
    ReviewModerateRequest,
    ReviewResponse,
)
from ..utils.security import log_action

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("", response_model=ReviewListResponse)
async def get_reviews(
    rating: Optional[int] = Query(None, ge=1, le=5, description="Фильтр по рейтингу"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Получить список опубликованных отзывов.
    Публичный эндпоинт.
    """
    query = db.query(Review).options(
        joinedload(Review.client).joinedload(Client.user),
        joinedload(Review.order),
    ).filter(Review.is_published == True, Review.is_moderated == True)
    
    if rating:
        query = query.filter(Review.rating == rating)
    
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    reviews = query.order_by(Review.created_at.desc()).offset(offset).limit(limit).all()
    
    items = [
        ReviewResponse(
            id=r.id,
            client_id=r.client_id,
            client_name=f"{r.client.user.first_name} {r.client.user.last_name}" if r.client and r.client.user else None,
            order_id=str(r.order_id) if r.order_id else None,
            order_number=r.order.order_number if r.order else None,
            rating=r.rating,
            text=r.text,
            is_moderated=r.is_moderated,
            is_published=r.is_published,
            created_at=r.created_at,
        )
        for r in reviews
    ]
    
    return ReviewListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["client"])),
):
    """
    Создать отзыв.
    Доступно: client.
    """
    # Получаем профиль клиента
    client = db.query(Client).filter(Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Профиль клиента не найден"
        )
    
    # Если указан order_id, проверяем заказ и что клиент его владелец
    order_id = None
    if review_data.order_id:
        order = db.query(Order).filter(Order.id == review_data.order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Заказ не найден"
            )
        if order.client_id != client.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нельзя оставить отзыв на чужой заказ"
            )
        
        # Проверяем, нет ли уже отзыва на этот заказ
        existing = db.query(Review).filter(
            Review.client_id == client.id,
            Review.order_id == order.id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Отзыв на этот заказ уже оставлен"
            )
        
        order_id = order.id
    
    db_review = Review(
        client_id=client.id,
        order_id=order_id,
        rating=review_data.rating,
        text=review_data.text,
        is_moderated=False,
        is_published=False,
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_review",
        entity_type="review",
        entity_id=str(db_review.id),
        description="Создан новый отзыв",
    )
    
    return ReviewResponse(
        id=db_review.id,
        client_id=db_review.client_id,
        client_name=f"{client.user.first_name} {client.user.last_name}",
        order_id=str(db_review.order_id) if db_review.order_id else None,
        order_number=None,
        rating=db_review.rating,
        text=db_review.text,
        is_moderated=db_review.is_moderated,
        is_published=db_review.is_published,
        created_at=db_review.created_at,
    )


@router.get("/pending", response_model=ReviewListResponse)
async def get_pending_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Получить все неопубликованные отзывы.
    Доступно: admin.
    """
    query = db.query(Review).options(
        joinedload(Review.client).joinedload(Client.user),
        joinedload(Review.order),
    ).filter(Review.is_published == False)
    
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    reviews = query.order_by(Review.created_at.desc()).offset(offset).limit(limit).all()
    
    items = [
        ReviewResponse(
            id=r.id,
            client_id=r.client_id,
            client_name=f"{r.client.user.first_name} {r.client.user.last_name}" if r.client and r.client.user else None,
            order_id=str(r.order_id) if r.order_id else None,
            order_number=r.order.order_number if r.order else None,
            rating=r.rating,
            text=r.text,
            is_moderated=r.is_moderated,
            is_published=r.is_published,
            created_at=r.created_at,
        )
        for r in reviews
    ]
    
    return ReviewListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.patch("/{review_id}/moderate", response_model=ReviewResponse)
async def moderate_review(
    review_id: int,
    moderate_data: ReviewModerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Модерировать отзыв (опубликовать/скрыть).
    Доступно: admin.
    """
    review = db.query(Review).options(
        joinedload(Review.client).joinedload(Client.user)
    ).filter(Review.id == review_id).first()
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Отзыв не найден"
        )
    
    old_published = review.is_published
    review.is_published = moderate_data.is_published
    review.is_moderated = True
    
    db.add(review)
    db.commit()
    db.refresh(review)

    # Обновляем рейтинг техника по опубликованным отзывам
    # (рейтинг должен учитывать оценки, которые клиент оставил к заказу).
    if review.order_id is not None:
        order = db.query(Order).filter(Order.id == review.order_id).first()
        if order and order.technician_id is not None:
            technician = db.query(Technician).filter(Technician.id == order.technician_id).first()
            if technician:
                avg_rating = (
                    db.query(func.avg(Review.rating))
                    .join(Order, Review.order_id == Order.id)
                    .filter(
                        Review.is_published == True,
                        Order.technician_id == order.technician_id,
                    )
                    .scalar()
                )
                technician.rating = float(avg_rating) if avg_rating is not None else 0.0
                db.add(technician)
                db.commit()

                # Логируем изменение рейтинга техника
                log_action(
                    db=db,
                    user_id=str(current_user.id),
                    action_type="update_technician_rating",
                    entity_type="technician",
                    entity_id=str(technician.id),
                    description=(
                        f"Рейтинг техника обновлён после модерации отзыва (review_id={review.id})."
                    ),
                )
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="moderate_review",
        entity_type="review",
        entity_id=str(review_id),
        description=f"Отзыв модерирован: опубликован={moderate_data.is_published}",
    )
    
    return ReviewResponse(
        id=review.id,
        client_id=review.client_id,
        client_name=f"{review.client.user.first_name} {review.client.user.last_name}" if review.client and review.client.user else None,
        order_id=str(review.order_id) if review.order_id else None,
        order_number=review.order.order_number if review.order else None,
        rating=review.rating,
        text=review.text,
        is_moderated=review.is_moderated,
        is_published=review.is_published,
        created_at=review.created_at,
    )
