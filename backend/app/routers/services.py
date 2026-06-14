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
from ..constants.service_categories import PREDEFINED_CATEGORY_NAMES
from ..schemas.service import (
    ServiceCategoryBrief,
    ServiceCategoryCreate,
    ServiceCategoryResponse,
    ServiceCategoryUpdate,
    ServiceCreate,
    ServiceListResponse,
    ServiceResponse,
    ServiceUpdate,
)
from ..utils.service_categories import ensure_predefined_categories

router = APIRouter(prefix="/services", tags=["services"])


def _service_to_response(service: Service) -> ServiceResponse:
    category = service.category
    return ServiceResponse(
        id=service.id,
        category_id=service.category_id,
        category_name=category.name if category else None,
        category=ServiceCategoryBrief(id=category.id, name=category.name) if category else None,
        name=service.name,
        description=service.description,
        base_price=service.base_price,
        unit=service.unit,
        duration_days=service.duration_days,
        is_active=service.is_active,
        created_at=service.created_at,
        updated_at=service.updated_at,
    )


def _validate_category_id(db: Session, category_id: int) -> ServiceCategory:
    ensure_predefined_categories(db)
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Категория не найдена",
        )
    if category.name not in PREDEFINED_CATEGORY_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Допустимы только предопределённые категории услуг",
        )
    return category


# =============================================================================
# Категории услуг
# =============================================================================


@router.get("/categories", response_model=list[ServiceCategoryResponse])
async def get_categories(
    db: Session = Depends(get_db),
    active_only: bool = Query(True, description="Только активные категории"),
):
    """
    Получить список предопределённых категорий услуг.
    Публичный эндпоинт.
    """
    ensure_predefined_categories(db)
    query = db.query(ServiceCategory).filter(
        ServiceCategory.name.in_(PREDEFINED_CATEGORY_NAMES)
    )
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

    items = [_service_to_response(service) for service in services]

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

    return _service_to_response(service)


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
    category = _validate_category_id(db, service.category_id)

    db_service = Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    db_service.category = category

    return _service_to_response(db_service)


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

    if "category_id" in update_data:
        _validate_category_id(db, update_data["category_id"])

    for field, value in update_data.items():
        setattr(db_service, field, value)

    db.commit()
    db.refresh(db_service)
    db_service = (
        db.query(Service)
        .options(joinedload(Service.category))
        .filter(Service.id == service_id)
        .first()
    )

    return _service_to_response(db_service)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Удалить услугу.
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

    db.delete(db_service)
    db.commit()
    return None
