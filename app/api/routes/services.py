from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models import Service, ServiceCategory, User, UserRole
from app.schemas import ServiceCreate, ServiceOut, ServiceUpdate, ServiceCategoryOut


router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("", response_model=list[ServiceOut])
async def get_services(
    category_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Публичный endpoint для получения списка услуг с фильтрами и пагинацией."""
    query = db.query(Service).options(joinedload(Service.category_rel))

    if category_id is not None:
        query = query.filter(Service.category_id == category_id)
    
    if is_active is not None:
        query = query.filter(Service.is_active == is_active)
    
    if search:
        query = query.filter(
            (Service.name.ilike(f"%{search}%")) |
            (Service.description.ilike(f"%{search}%"))
        )

    offset = (page - 1) * limit
    services = query.offset(offset).limit(limit).all()
    
    return services


@router.get("/categories", response_model=list[ServiceCategoryOut])
async def get_categories(
    db: Session = Depends(get_db),
):
    """Публичный endpoint для получения списка категорий услуг."""
    categories = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    return categories


@router.get("/{service_id}", response_model=ServiceOut)
async def get_service(
    service_id: int,
    db: Session = Depends(get_db),
):
    """Публичный endpoint для получения одной услуги."""
    service = db.query(Service).options(
        joinedload(Service.category_rel)
    ).filter(Service.id == service_id).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    return service


@router.post("", response_model=ServiceOut)
async def create_service(
    service: ServiceCreate,
    current_user: User = Depends(require_roles([UserRole.MANAGER, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Создание услуги (только manager/admin)."""
    if service.category_id:
        category = db.query(ServiceCategory).filter(ServiceCategory.id == service.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    new_service = Service(**service.dict())
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service


@router.put("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: int,
    service_update: ServiceUpdate,
    current_user: User = Depends(require_roles([UserRole.MANAGER, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Обновление услуги (только manager/admin)."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_data = service_update.dict(exclude_unset=True)
    if "category_id" in update_data and update_data["category_id"] is not None:
        category = db.query(ServiceCategory).filter(ServiceCategory.id == update_data["category_id"]).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    for field, value in update_data.items():
        setattr(service, field, value)

    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}")
async def delete_service(
    service_id: int,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Удаление услуги (только admin)."""
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    db.delete(service)
    db.commit()
    return {"message": "Service deleted successfully"}
