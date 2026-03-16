"""
Роутеры для базы знаний.
"""
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.knowledge import KnowledgeBase
from ..models.user import User, UserRole
from ..schemas.secondary import (
    KnowledgeBaseCreate,
    KnowledgeBaseListResponse,
    KnowledgeBaseResponse,
    KnowledgeBaseUpdate,
)
from ..utils.security import log_action

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.get("", response_model=KnowledgeBaseListResponse)
async def get_knowledge_base(
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    search: Optional[str] = Query(None, min_length=1, description="Поиск по заголовку"),
    tags: Optional[str] = Query(None, description="Теги через запятую"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician", "manager", "admin"])),
):
    """
    Получить список записей базы знаний.
    Доступно: technician, manager, admin.
    """
    query = db.query(KnowledgeBase).options(
        joinedload(KnowledgeBase.author)
    )
    
    # Показываем только опубликованные для technician, все для manager/admin
    if current_user.role == UserRole.TECHNICIAN:
        query = query.filter(KnowledgeBase.is_published == True)
    
    # Фильтры
    if category:
        query = query.filter(KnowledgeBase.category == category)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                KnowledgeBase.title.ilike(search_pattern),
                KnowledgeBase.content.ilike(search_pattern),
            )
        )
    
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        # PostgreSQL array overlap
        query = query.filter(KnowledgeBase.tags.overlap(tag_list))
    
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    records = query.order_by(KnowledgeBase.created_at.desc()).offset(offset).limit(limit).all()
    
    items = [
        KnowledgeBaseResponse(
            id=r.id,
            title=r.title,
            content=r.content,
            category=r.category,
            tags=r.tags,
            created_by=str(r.created_by),
            author_name=f"{r.author.first_name} {r.author.last_name}" if r.author else None,
            is_published=r.is_published,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in records
    ]
    
    return KnowledgeBaseListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{record_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician", "manager", "admin"])),
):
    """
    Получить запись базы знаний по ID.
    Доступно: technician, manager, admin.
    """
    record = db.query(KnowledgeBase).options(
        joinedload(KnowledgeBase.author)
    ).filter(KnowledgeBase.id == record_id).first()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    # Проверка доступа
    if current_user.role == UserRole.TECHNICIAN and not record.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    return KnowledgeBaseResponse(
        id=record.id,
        title=record.title,
        content=record.content,
        category=record.category,
        tags=record.tags,
        created_by=str(record.created_by),
        author_name=f"{record.author.first_name} {record.author.last_name}" if record.author else None,
        is_published=record.is_published,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_record(
    record_data: KnowledgeBaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Создать запись в базе знаний.
    Доступно: manager, admin.
    """
    db_record = KnowledgeBase(
        title=record_data.title,
        content=record_data.content,
        category=record_data.category,
        tags=record_data.tags,
        created_by=current_user.id,
        is_published=record_data.is_published,
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_knowledge_base",
        entity_type="knowledge_base",
        entity_id=str(db_record.id),
        description=f"Создана запись БЗ {db_record.title}",
    )
    
    return KnowledgeBaseResponse(
        id=db_record.id,
        title=db_record.title,
        content=db_record.content,
        category=db_record.category,
        tags=db_record.tags,
        created_by=str(db_record.created_by),
        author_name=f"{current_user.first_name} {current_user.last_name}",
        is_published=db_record.is_published,
        created_at=db_record.created_at,
        updated_at=db_record.updated_at,
    )


@router.put("/{record_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_record(
    record_id: int,
    record_data: KnowledgeBaseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить запись базы знаний.
    Доступно: manager, admin.
    """
    record = db.query(KnowledgeBase).filter(KnowledgeBase.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(record, field, value)
    
    db.add(record)
    db.commit()
    db.refresh(record)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_knowledge_base",
        entity_type="knowledge_base",
        entity_id=str(record_id),
        description=f"Обновлена запись БЗ {record.title}",
    )
    
    return KnowledgeBaseResponse(
        id=record.id,
        title=record.title,
        content=record.content,
        category=record.category,
        tags=record.tags,
        created_by=str(record.created_by),
        author_name=f"{record.author.first_name} {record.author.last_name}" if record.author else None,
        is_published=record.is_published,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Удалить запись базы знаний.
    Доступно: admin.
    """
    record = db.query(KnowledgeBase).filter(KnowledgeBase.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись не найдена"
        )
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="delete_knowledge_base",
        entity_type="knowledge_base",
        entity_id=str(record_id),
        description=f"Удалена запись БЗ {record.title}",
    )
    
    db.delete(record)
    db.commit()
    
    return None
