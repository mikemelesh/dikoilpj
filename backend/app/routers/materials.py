"""
Роутеры для управления материалами и запросами.
"""
import math
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.client import Client
from ..models.material import Material
from ..models.order import MaterialRequest, MaterialRequestStatus
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..schemas.materials import (
    MaterialCreate,
    MaterialListResponse,
    MaterialRequestCreate,
    MaterialRequestListResponse,
    MaterialRequestResponse,
    MaterialRequestUpdate,
    MaterialResponse,
    MaterialUpdate,
)
from ..utils.security import log_action

router = APIRouter(prefix="/materials", tags=["materials"])


# =============================================================================
# Материалы
# =============================================================================


@router.get("", response_model=MaterialListResponse)
async def get_materials(
    search: Optional[str] = Query(None, min_length=1, description="Поиск по названию"),
    low_stock_only: bool = Query(False, description="Только с низким остатком"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician", "manager", "admin"])),
):
    """
    Получить список материалов.
    Доступно: technician, manager, admin.
    """
    query = db.query(Material)
    
    # Поиск
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Material.name.ilike(search_pattern))
    
    # Только с низким остатком
    if low_stock_only:
        query = query.filter(Material.quantity <= Material.min_quantity)
    
    materials = query.order_by(Material.name).all()
    
    items = [
        MaterialResponse(
            id=m.id,
            name=m.name,
            description=m.description,
            unit=m.unit,
            quantity=m.quantity,
            min_quantity=m.min_quantity,
            price_per_unit=m.price_per_unit,
            supplier=m.supplier,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
        for m in materials
    ]
    
    return MaterialListResponse(items=items, total=len(items))


@router.post("", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
async def create_material(
    material: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Создать новый материал.
    Доступно: manager, admin.
    """
    # Проверка на дубликат
    existing = db.query(Material).filter(
        func.lower(Material.name) == func.lower(material.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Материал с таким названием уже существует"
        )
    
    db_material = Material(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_material",
        entity_type="material",
        entity_id=str(db_material.id),
        description=f"Создан материал {db_material.name}",
    )
    
    return MaterialResponse(
        id=db_material.id,
        name=db_material.name,
        description=db_material.description,
        unit=db_material.unit,
        quantity=db_material.quantity,
        min_quantity=db_material.min_quantity,
        price_per_unit=db_material.price_per_unit,
        supplier=db_material.supplier,
        created_at=db_material.created_at,
        updated_at=db_material.updated_at,
    )


@router.put("/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: int,
    material: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обновить материал.
    Доступно: manager, admin.
    """
    db_material = db.query(Material).filter(Material.id == material_id).first()
    if not db_material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Материал не найден"
        )
    
    update_data = material.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_material, field, value)
    
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_material",
        entity_type="material",
        entity_id=str(material_id),
        description=f"Обновлён материал {db_material.name}",
    )
    
    return MaterialResponse(
        id=db_material.id,
        name=db_material.name,
        description=db_material.description,
        unit=db_material.unit,
        quantity=db_material.quantity,
        min_quantity=db_material.min_quantity,
        price_per_unit=db_material.price_per_unit,
        supplier=db_material.supplier,
        created_at=db_material.created_at,
        updated_at=db_material.updated_at,
    )


# =============================================================================
# Запросы материалов
# =============================================================================


@router.post("/requests", response_model=MaterialRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_material_request(
    request_data: MaterialRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Создать запрос на получение материала.
    Доступно: technician.
    """
    # Проверяем техника
    technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Профиль техника не найден"
        )
    
    # Проверяем материал
    material = db.query(Material).filter(Material.id == request_data.material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Материал не найден"
        )
    
    # Создаём запрос
    db_request = MaterialRequest(
        technician_id=technician.id,
        material_id=material.id,
        quantity_requested=request_data.quantity_requested,
        comment=request_data.comment,
        status=MaterialRequestStatus.PENDING,
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_material_request",
        entity_type="material_request",
        entity_id=str(db_request.id),
        description=f"Запрошен материал {material.name} ({request_data.quantity_requested} {material.unit})",
    )
    
    return MaterialRequestResponse(
        id=db_request.id,
        technician_id=db_request.technician_id,
        technician_name=f"{technician.user.first_name} {technician.user.last_name}",
        material_id=db_request.material_id,
        material_name=material.name,
        quantity_requested=db_request.quantity_requested,
        quantity_available=material.quantity,
        status=db_request.status,
        comment=db_request.comment,
        created_at=db_request.created_at,
        resolved_by=None,
        resolved_at=None,
    )


@router.get("/requests", response_model=MaterialRequestListResponse)
async def get_material_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    technician_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Получить список запросов материалов.
    Доступно: manager, admin.
    """
    # Валидация статуса
    valid_statuses = ["pending", "approved", "rejected", "issued"]
    if status_filter and status_filter not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый статус. Допустимые: {', '.join(valid_statuses)}"
        )
    
    query = db.query(MaterialRequest).options(
        joinedload(MaterialRequest.technician).joinedload(Technician.user),
        joinedload(MaterialRequest.material),
        joinedload(MaterialRequest.resolver),
    )
    
    # Фильтры
    if status_filter:
        query = query.filter(MaterialRequest.status == status_filter)
    if technician_id:
        query = query.filter(MaterialRequest.technician_id == technician_id)
    
    # Пагинация
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    requests = query.order_by(MaterialRequest.created_at.desc()).offset(offset).limit(limit).all()
    
    items = [
        MaterialRequestResponse(
            id=mr.id,
            technician_id=mr.technician_id,
            technician_name=f"{mr.technician.user.first_name} {mr.technician.user.last_name}" if mr.technician else None,
            material_id=mr.material_id,
            material_name=mr.material.name if mr.material else None,
            quantity_requested=mr.quantity_requested,
            quantity_available=mr.material.quantity if mr.material else Decimal("0"),
            status=mr.status,
            comment=mr.comment,
            created_at=mr.created_at,
            resolved_by=str(mr.resolved_by) if mr.resolved_by else None,
            resolved_at=mr.resolved_at,
        )
        for mr in requests
    ]
    
    return MaterialRequestListResponse(items=items, total=total)


@router.patch("/requests/{request_id}", response_model=MaterialRequestResponse)
async def update_material_request(
    request_id: int,
    request_data: MaterialRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Обработать запрос на материал (одобрить/отклонить).
    Доступно: manager, admin.
    """
    db_request = db.query(MaterialRequest).options(
        joinedload(MaterialRequest.technician),
        joinedload(MaterialRequest.material),
    ).filter(MaterialRequest.id == request_id).first()
    
    if not db_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запрос не найден"
        )
    
    # Проверка статуса
    if db_request.status != MaterialRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Запрос уже обработан (статус: {db_request.status})"
        )
    
    # Валидация нового статуса
    new_status = request_data.status.lower()
    if new_status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статус должен быть 'approved' или 'rejected'"
        )
    
    old_status = db_request.status
    db_request.status = new_status
    db_request.comment = request_data.comment
    db_request.resolved_by = current_user.id
    db_request.resolved_at = datetime.utcnow()
    
    # Если одобрено — списываем материал
    if new_status == "approved":
        material = db_request.material
        if material.quantity < db_request.quantity_requested:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно материала на складе. Доступно: {material.quantity}"
            )
        material.quantity -= db_request.quantity_requested
    
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_material_request",
        entity_type="material_request",
        entity_id=str(request_id),
        description=f"Запрос на материал изменён: {old_status} → {new_status}",
    )
    
    return MaterialRequestResponse(
        id=db_request.id,
        technician_id=db_request.technician_id,
        technician_name=f"{db_request.technician.user.first_name} {db_request.technician.user.last_name}" if db_request.technician else None,
        material_id=db_request.material_id,
        material_name=db_request.material.name if db_request.material else None,
        quantity_requested=db_request.quantity_requested,
        quantity_available=db_request.material.quantity if db_request.material else Decimal("0"),
        status=db_request.status,
        comment=db_request.comment,
        created_at=db_request.created_at,
        resolved_by=str(db_request.resolved_by),
        resolved_at=db_request.resolved_at,
    )
