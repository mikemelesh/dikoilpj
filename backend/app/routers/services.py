"""
Роутеры для управления услугами и категориями.
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.service import Service, ServiceCategory
from ..models.user import User
from ..schemas.service import (
    ServiceCategoryCreate,
    ServiceCategoryResponse,
    ServiceCategoryUpdate,
    ServiceCreate,
    ServiceListResponse,
    ServiceResponse,
    ServiceUpdate,
)

router = APIRouter(prefix="/services", tags=["services"])


# =============================================================================
# Категории услуг
# =============================================================================


@router.get("/categories", response_model=list[ServiceCategoryResponse])
async def get_categories(
    db: Session = Depends(get_db),
    active_only: bool = Query(True, description="Только активные категории"),
):
    """
    Получить список всех категорий услуг.
    Публичный эндпоинт.
    """
    query = db.query(ServiceCategory)
    if active_only:
        query = query.filter(ServiceCategory.is_active == True)
    query = query.order_by(ServiceCategory.sort_order, ServiceCategory.name)
    return query.all()


@router.get("/categories/{category_id}", response_model=ServiceCategoryResponse)
async def get_category(
    category_id: int,
    db: Session = Depends(get_db),
):
    """Получить категорию по ID."""
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )
    return category


@router.post(
    "/categories",
    response_model=ServiceCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    category: ServiceCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Создать новую категорию услуг.
    Доступно: manager, admin.
    """
    # Проверка на дубликат названия
    existing = db.query(ServiceCategory).filter(
        ServiceCategory.name == category.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Категория с таким названием уже существует"
        )

    db_category = ServiceCategory(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/categories/{category_id}", response_model=ServiceCategoryResponse)
async def update_category(
    category_id: int,
    category: ServiceCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить категорию услуг.
    Доступно: manager, admin.
    """
    db_category = db.query(ServiceCategory).filter(
        ServiceCategory.id == category_id
    ).first()
    if not db_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )

    update_data = category.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_category, field, value)

    db.commit()
    db.refresh(db_category)
    return db_category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Удалить категорию услуг.
    Доступно: только admin.
    """
    db_category = db.query(ServiceCategory).filter(
        ServiceCategory.id == category_id
    ).first()
    if not db_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )

    # Проверка, есть ли услуги в категории
    services_count = db.query(Service).filter(
        Service.category_id == category_id
    ).count()
    if services_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Нельзя удалить категорию с {services_count} услугами"
        )

    db.delete(db_category)
    db.commit()
    return None


# =============================================================================
# Услуги
# =============================================================================


@router.get("", response_model=ServiceListResponse)
async def get_services(
    category_id: Optional[int] = Query(None, description="Фильтр по категории"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
    search: Optional[str] = Query(None, min_length=1, description="Поиск по названию и описанию"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    limit: int = Query(20, ge=1, le=100, description="Размер страницы"),
    db: Session = Depends(get_db),
):
    """
    Получить список услуг с фильтрами и пагинацией.
    Публичный эндпоинт.
    """
    query = db.query(Service).options(
        joinedload(Service.category)
    )

    # Фильтры
    if category_id is not None:
        query = query.filter(Service.category_id == category_id)
    if is_active is not None:
        query = query.filter(Service.is_active == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Service.name.ilike(search_pattern),
                Service.description.ilike(search_pattern),
            )
        )

    # Пагинация
    total = query.count()
    pages = math.ceil(total / limit)
    offset = (page - 1) * limit
    services = query.offset(offset).limit(limit).all()

    # Формируем ответ
    items = []
    for service in services:
        items.append(ServiceResponse(
            id=service.id,
            category_id=service.category_id,
            category_name=service.category.name if service.category else None,
            name=service.name,
            description=service.description,
            base_price=service.base_price,
            unit=service.unit,
            duration_days=service.duration_days,
            is_active=service.is_active,
            created_at=service.created_at,
            updated_at=service.updated_at,
        ))

    return ServiceListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Получить услугу по ID."""
    service = db.query(Service).options(
        joinedload(Service.category)
    ).filter(Service.id == service_id).first()

    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Услуга не найдена"
        )

    return ServiceResponse(
        id=service.id,
        category_id=service.category_id,
        category_name=service.category.name if service.category else None,
        name=service.name,
        description=service.description,
        base_price=service.base_price,
        unit=service.unit,
        duration_days=service.duration_days,
        is_active=service.is_active,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Создать новую услугу.
    Доступно: manager, admin.
    """
    # Проверка существования категории
    category = db.query(ServiceCategory).filter(
        ServiceCategory.id == service.category_id
    ).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Категория не найдена"
        )

    db_service = Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)

    return ServiceResponse(
        id=db_service.id,
        category_id=db_service.category_id,
        category_name=category.name,
        name=db_service.name,
        description=db_service.description,
        base_price=db_service.base_price,
        unit=db_service.unit,
        duration_days=db_service.duration_days,
        is_active=db_service.is_active,
        created_at=db_service.created_at,
        updated_at=db_service.updated_at,
    )


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: int,
    service: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить услугу.
    Доступно: manager, admin.
    """
    db_service = db.query(Service).filter(
        Service.id == service_id
    ).first()
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Услуга не найдена"
        )

    update_data = service.model_dump(exclude_unset=True)

    # Если меняется категория, проверяем её существование
    if "category_id" in update_data:
        category = db.query(ServiceCategory).filter(
            ServiceCategory.id == update_data["category_id"]
        ).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Категория не найдена"
            )

    for field, value in update_data.items():
        setattr(db_service, field, value)

    db.commit()
    db.refresh(db_service)

    return ServiceResponse(
        id=db_service.id,
        category_id=db_service.category_id,
        category_name=db_service.category.name if db_service.category else None,
        name=db_service.name,
        description=db_service.description,
        base_price=db_service.base_price,
        unit=db_service.unit,
        duration_days=db_service.duration_days,
        is_active=db_service.is_active,
        created_at=db_service.created_at,
        updated_at=db_service.updated_at,
    )


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Удалить услугу.
    Доступно: только admin.
    """
    db_service = db.query(Service).filter(
        Service.id == service_id
    ).first()
    if not db_service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Услуга не найдена"
        )

    db.delete(db_service)
    db.commit()
    return None
