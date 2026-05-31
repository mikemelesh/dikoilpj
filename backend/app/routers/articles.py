"""
Роутеры для статей.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.article import Article
from ..models.user import User, UserRole
from ..schemas.secondary import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)
from ..utils.security import log_action

router = APIRouter(prefix="/articles", tags=["articles"])


def _get_author_names_bulk(db: Session, user_ids: set) -> dict:
    """Массовая загрузка имен авторов по ID."""
    if not user_ids:
        return {}
    
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    return {
        str(user.id): f"{user.first_name} {user.last_name}" if user.first_name or user.last_name else user.email
        for user in users
    }


@router.get("", response_model=ArticleListResponse)
async def get_articles(
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    search: Optional[str] = Query(None, min_length=1, description="Поиск по заголовку"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Получить список опубликованных статей.
    Публичный эндпоинт.
    """
    query = db.query(Article).filter(Article.is_published == True)

    if category:
        query = query.filter(Article.category == category)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Article.title.ilike(search_pattern))

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    articles = query.order_by(Article.created_at.desc()).offset(offset).limit(limit).all()

    # Загружаем имена авторов
    author_ids = {str(a.author_id) for a in articles if a.author_id}
    author_names = _get_author_names_bulk(db, author_ids)

    items = [
        ArticleResponse(
            id=a.id,
            title=a.title,
            slug=a.slug,
            content=a.content,
            category=a.category,
            author_id=str(a.author_id),
            author_name=author_names.get(str(a.author_id)),
            is_published=a.is_published,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )
        for a in articles
    ]

    return ArticleListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/{slug}", response_model=ArticleResponse)
async def get_article(
    slug: str,
    db: Session = Depends(get_db),
):
    """
    Получить статью по слагy.
    Публичный эндпоинт (опубликованные).
    """
    article = db.query(Article).filter(
        Article.slug == slug,
        Article.is_published == True
    ).first()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )

    # Загружаем имя автора
    author_name = None
    if article.author_id:
        author = db.query(User).filter(User.id == article.author_id).first()
        if author:
            author_name = f"{author.first_name} {author.last_name}" if author.first_name or author.last_name else author.email

    return ArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug,
        content=article.content,
        category=article.category,
        author_id=str(article.author_id),
        author_name=author_name,
        is_published=article.is_published,
        created_at=article.created_at,
        updated_at=article.updated_at,
    )


@router.post("", response_model=ArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    article_data: ArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Создать статью.
    Доступно: admin.
    """
    # Проверка на дубликат слага
    existing = db.query(Article).filter(Article.slug == article_data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статья с таким URL уже существует"
        )
    
    db_article = Article(
        title=article_data.title,
        slug=article_data.slug,
        content=article_data.content,
        category=article_data.category,
        author_id=current_user.id,
        is_published=article_data.is_published,
    )
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_article",
        entity_type="article",
        entity_id=str(db_article.id),
        description=f"Создана статья {db_article.title}",
    )
    
    return ArticleResponse(
        id=db_article.id,
        title=db_article.title,
        slug=db_article.slug,
        content=db_article.content,
        category=db_article.category,
        author_id=str(db_article.author_id),
        author_name=f"{current_user.first_name} {current_user.last_name}",
        is_published=db_article.is_published,
        created_at=db_article.created_at,
        updated_at=db_article.updated_at,
    )


@router.put("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    article_data: ArticleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Обновить статью.
    Доступно: admin.
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )

    # Проверка слага на уникальность
    if article_data.slug and article_data.slug != article.slug:
        existing = db.query(Article).filter(
            Article.slug == article_data.slug,
            Article.id != article_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Статья с таким URL уже существует"
            )

    update_data = article_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(article, field, value)

    db.add(article)
    db.commit()
    db.refresh(article)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_article",
        entity_type="article",
        entity_id=str(article_id),
        description=f"Обновлена статья {article.title}",
    )

    # Загружаем имя автора
    author_name = None
    if article.author_id:
        author = db.query(User).filter(User.id == article.author_id).first()
        if author:
            author_name = f"{author.first_name} {author.last_name}" if author.first_name or author.last_name else author.email

    return ArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug,
        content=article.content,
        category=article.category,
        author_id=str(article.author_id),
        author_name=author_name,
        is_published=article.is_published,
        created_at=article.created_at,
        updated_at=article.updated_at,
    )


@router.delete("/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Удалить статью.
    Доступно: admin.
    """
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Статья не найдена"
        )
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="delete_article",
        entity_type="article",
        entity_id=str(article_id),
        description=f"Удалена статья {article.title}",
    )
    
    db.delete(article)
    db.commit()
    
    return None
