"""
Роутеры для управления заказами.
"""
import math
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.client import Client
from ..models.order import (
    MaterialRequest,
    Order,
    OrderFile,
    OrderItem,
    OrderPriority,
    OrderStatus,
    OrderStatusHistory,
)
from ..models.service import Service
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..schemas.order import (
    OrderAssignRequest,
    OrderCreate,
    OrderFileResponse,
    OrderListResponse,
    OrderResponse,
    OrderStatusUpdate,
    OrderSummaryResponse,
    OrderUpdate,
)
from ..utils.files import save_file, validate_file
from ..utils.loyalty import apply_client_discount, update_client_loyalty
from ..utils.security import log_action

router = APIRouter(prefix="/orders", tags=["orders"])


# =============================================================================
# Вспомогательные функции
# =============================================================================


def generate_order_number() -> str:
    """Генерация номера заказа в формате ORD-YYYYMMDD-XXXX."""
    today = date.today().strftime("%Y%m%d")
    random_part = uuid.uuid4().hex[:4].upper()
    return f"ORD-{today}-{random_part}"


def get_order_with_relations(db: Session, order_id: str) -> Optional[Order]:
    """Получение заказа со всеми связями."""
    return db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.files),
        joinedload(Order.status_history),
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    ).filter(Order.id == order_id).first()


def get_order_response(db: Session, order: Order) -> OrderResponse:
    """Формирование ответа заказа с названиями услуг."""
    # Загружаем названия услуг для всех items
    service_ids = {item.service_id for item in order.items}
    services = {s.id: s.name for s in db.query(Service).filter(Service.id.in_(service_ids)).all()} if service_ids else {}

    # Формируем client_name
    client_name = None
    if order.client and order.client.user:
        client_name = f"{order.client.user.first_name} {order.client.user.last_name}"

    # Формируем technician_name
    technician_name = None
    if order.technician and order.technician.user:
        technician_name = f"{order.technician.user.first_name} {order.technician.user.last_name}"

    # Формируем items с service_name
    items_data = [
        {
            "id": item.id,
            "order_id": str(item.order_id),
            "service_id": item.service_id,
            "service_name": services.get(item.service_id),
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price,
            "specifications": item.specifications,
        }
        for item in order.items
    ]

    # Формируем files
    files_data = [
        {
            "id": f.id,
            "order_id": str(f.order_id),
            "file_name": f.file_name,
            "file_path": f.file_path,
            "file_type": f.file_type,
            "file_size": f.file_size,
            "created_at": f.created_at,
            "uploaded_by": str(f.uploaded_by),
        }
        for f in order.files
    ]

    # Формируем status_history
    status_history_data = [
        {
            "id": h.id,
            "order_id": str(h.order_id),
            "old_status": h.old_status,
            "new_status": h.new_status,
            "comment": h.comment,
            "created_at": h.created_at,
            "changed_by": str(h.changed_by),
        }
        for h in order.status_history
    ]

    return OrderResponse(
        id=str(order.id),
        order_number=order.order_number,
        client_id=order.client_id,
        client_name=client_name,
        technician_id=order.technician_id,
        technician_name=technician_name,
        manager_id=str(order.manager_id) if order.manager_id else None,
        status=order.status,
        priority=order.priority,
        total_price=order.total_price,
        discount_amount=order.discount_amount,
        final_price=order.final_price,
        notes=order.notes,
        deadline=order.deadline,
        created_at=order.created_at,
        updated_at=order.updated_at,
        completed_at=order.completed_at,
        items=items_data,
        files=files_data,
        status_history=status_history_data,
    )


def create_status_history(
    db: Session,
    order: Order,
    old_status: OrderStatus,
    new_status: OrderStatus,
    changed_by: User,
    comment: Optional[str] = None,
) -> OrderStatusHistory:
    """Создание записи в истории статусов."""
    history = OrderStatusHistory(
        order_id=order.id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by.id,
        comment=comment,
    )
    db.add(history)
    return history


# =============================================================================
# Список заказов
# =============================================================================


@router.get("", response_model=OrderListResponse)
async def get_orders(
    status_filter: Optional[list[str]] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    client_id: Optional[int] = Query(None),
    technician_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Получить список заказов с фильтрами.

    - client видит только свои заказы
    - technician видит назначенные ему заказы
    - manager/admin видят все заказы
    
    status_filter может принимать несколько значений: ?status=completed&status=archived
    """
    # Валидация статусов и приоритета
    valid_statuses = ["new", "confirmed", "in_progress", "review", "completed", "cancelled", "archived"]
    valid_priorities = ["normal", "urgent", "critical"]

    # Проверяем все переданные статусы
    if status_filter:
        for s in status_filter:
            if s not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недопустимый статус: {s}. Допустимые: {', '.join(valid_statuses)}"
                )
    
    if priority and priority not in valid_priorities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый приоритет. Допустимые: {', '.join(valid_priorities)}"
        )
    
    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    )

    # Фильтрация по ролям
    if current_user.role == UserRole.CLIENT:
        client_profile = db.query(Client).filter(Client.user_id == current_user.id).first()
        if client_profile:
            query = query.filter(Order.client_id == client_profile.id)
        else:
            return OrderListResponse(items=[], total=0, page=page, limit=limit, pages=0)
    
    elif current_user.role == UserRole.TECHNICIAN:
        technician_profile = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if technician_profile:
            query = query.filter(Order.technician_id == technician_profile.id)
    
    # Если client_id указан (для manager/admin)
    if client_id is not None and current_user.role in [UserRole.MANAGER, UserRole.ADMIN]:
        query = query.filter(Order.client_id == client_id)
    
    # Фильтры
    if status_filter:
        query = query.filter(Order.status.in_(status_filter))
    if priority:
        query = query.filter(Order.priority == priority)
    if date_from:
        query = query.filter(Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Order.created_at <= datetime.combine(date_to, datetime.max.time()))
    if technician_id is not None:
        query = query.filter(Order.technician_id == technician_id)

    # Пагинация
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    orders = query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()

    # Формируем ответ
    items = []
    for order in orders:
        # Формируем technician_name
        technician_name = None
        if order.technician and order.technician.user:
            technician_name = f"{order.technician.user.first_name} {order.technician.user.last_name}"

        items.append(OrderSummaryResponse(
            id=str(order.id),
            order_number=order.order_number,
            status=order.status,
            priority=order.priority,
            final_price=order.final_price,
            created_at=order.created_at,
            deadline=order.deadline,
            technician_id=order.technician_id,
            technician_name=technician_name,
        ))

    return OrderListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


# =============================================================================
# Создание заказа
# =============================================================================


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["client"])),
):
    """
    Создать новый заказ.
    Доступно: только client.
    """
    # Получаем профиль клиента
    client = db.query(Client).filter(Client.user_id == current_user.id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Профиль клиента не найден"
        )

    # Проверяем услуги и считаем сумму
    total_price = Decimal("0.00")
    order_items_data = []

    for item_data in order_data.items:
        service = db.query(Service).filter(Service.id == item_data.service_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Услуга с ID {item_data.service_id} не найдена"
            )
        if not service.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Услуга '{service.name}' неактивна"
            )

        item_total = service.base_price * item_data.quantity
        total_price += item_total

        order_items_data.append({
            "service_id": item_data.service_id,
            "service_name": service.name,
            "quantity": item_data.quantity,
            "unit_price": service.base_price,
            "total_price": item_total,
            "specifications": item_data.specifications,
        })

    # Применяем скидку клиента
    discount_amount, final_price, _ = apply_client_discount(total_price, client)

    # Создаём заказ
    order = Order(
        order_number=generate_order_number(),
        client_id=client.id,
        status=OrderStatus.NEW,
        priority=order_data.priority,
        total_price=total_price,
        discount_amount=discount_amount,
        final_price=final_price,
        notes=order_data.notes,
        deadline=order_data.deadline,
    )
    db.add(order)
    db.flush()  # Получаем ID заказа

    # Создаём позиции заказа
    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=order.id,
            service_id=item_data["service_id"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            total_price=item_data["total_price"],
            specifications=item_data["specifications"],
        )
        db.add(order_item)

    # Создаём первую запись в истории статусов
    create_status_history(
        db=db,
        order=order,
        old_status=OrderStatus.NEW,
        new_status=OrderStatus.NEW,
        changed_by=current_user,
        comment="Заказ создан",
    )

    db.commit()
    db.refresh(order)

    # Логирование
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="create_order",
        entity_type="order",
        entity_id=str(order.id),
        description=f"Создан заказ {order.order_number}",
    )

    return get_order_response(db, order)


# =============================================================================
# Получение заказа по ID
# =============================================================================


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Получить заказ по ID.
    """
    order = get_order_with_relations(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    # Проверка прав доступа
    if current_user.role == UserRole.CLIENT:
        client_profile = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client_profile or order.client_id != client_profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещён"
            )

    elif current_user.role == UserRole.TECHNICIAN:
        technician_profile = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician_profile or order.technician_id != technician_profile.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещён"
            )

    return get_order_response(db, order)


# =============================================================================
# Обновление заказа (клиентом)
# =============================================================================


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    order_data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Обновить заказ (клиент может редактировать только при status='new').
    Доступно: client (только свои заказы со статусом new).
    """
    order = get_order_with_relations(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    # Проверка прав
    client_profile = db.query(Client).filter(Client.user_id == current_user.id).first()
    if not client_profile or order.client_id != client_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён"
        )

    # Можно редактировать только новые заказы
    if order.status != "new":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Можно редактировать только заказы со статусом 'new'"
        )

    # Обновляем поля
    update_data = order_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    db.commit()
    db.refresh(order)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_order",
        entity_type="order",
        entity_id=str(order.id),
        description=f"Обновлён заказ {order.order_number}",
    )

    return get_order_response(db, order)


# =============================================================================
# Изменение статуса заказа
# =============================================================================


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin", "technician"])),
):
    """
    Изменить статус заказа.
    Доступно: manager, admin, technician.
    """
    order = get_order_with_relations(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    old_status = order.status
    new_status = status_data.new_status

    # Преобразуем строки в OrderStatus для сравнения
    try:
        old_status_enum = OrderStatus(old_status)
        new_status_enum = OrderStatus(new_status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый статус заказа"
        )

    # Проверка допустимых переходов
    allowed_transitions = {
        OrderStatus.NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        OrderStatus.CONFIRMED: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
        OrderStatus.IN_PROGRESS: [OrderStatus.REVIEW, OrderStatus.CANCELLED],
        OrderStatus.REVIEW: [OrderStatus.COMPLETED, OrderStatus.IN_PROGRESS],
        OrderStatus.COMPLETED: [OrderStatus.ARCHIVED],
        OrderStatus.CANCELLED: [],
        OrderStatus.ARCHIVED: [],
    }

    if new_status_enum not in allowed_transitions.get(old_status_enum, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимый переход статуса: {old_status} → {new_status}"
        )

    # Обновляем статус
    order.status = new_status
    if new_status == "completed":
        order.completed_at = datetime.now(timezone.utc)

    # Создаём запись в истории
    create_status_history(
        db=db,
        order=order,
        old_status=old_status_enum,
        new_status=new_status_enum,
        changed_by=current_user,
        comment=status_data.comment,
    )

    # Если заказ завершён — обновляем лояльность клиента
    if new_status == "completed":
        client = order.client
        update_client_loyalty(db, client, order.final_price)

    db.commit()
    db.refresh(order)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="change_order_status",
        entity_type="order",
        entity_id=str(order.id),
        description=f"Статус заказа {order.order_number} изменён: {old_status} → {new_status}",
    )

    return get_order_response(db, order)


# =============================================================================
# Назначение исполнителя
# =============================================================================


@router.patch("/{order_id}/assign", response_model=OrderResponse)
async def assign_technician(
    order_id: str,
    assign_data: OrderAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Назначить исполнителя на заказ.
    Доступно: manager, admin.
    """
    order = get_order_with_relations(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    # Проверяем техника
    technician = db.query(Technician).filter(Technician.id == assign_data.technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Техник не найден"
        )
    if not technician.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Техник недоступен"
        )

    old_technician_id = order.technician_id
    order.technician_id = assign_data.technician_id

    db.commit()
    db.refresh(order)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="assign_technician",
        entity_type="order",
        entity_id=str(order.id),
        description=f"Назначен техник {technician.user.first_name} {technician.user.last_name}",
    )

    return get_order_response(db, order)


# =============================================================================
# Файлы заказов
# =============================================================================


@router.post("/{order_id}/files", response_model=OrderFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_order_file(
    order_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Загрузить файл к заказу.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заказ не найден"
        )

    # Проверка прав
    if current_user.role == UserRole.CLIENT:
        client_profile = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client_profile or order.client_id != client_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")
    
    elif current_user.role == UserRole.TECHNICIAN:
        technician_profile = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not technician_profile or order.technician_id != technician_profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещён")

    # Валидация файла
    is_valid, error_msg = validate_file(file)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    # Сохраняем файл
    file_path = save_file(file, str(order_id))

    # Создаём запись в БД
    order_file = OrderFile(
        order_id=order.id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file.content_type or "application/octet-stream",
        file_size=file.size or 0,
    )
    db.add(order_file)
    db.commit()
    db.refresh(order_file)

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="upload_file",
        entity_type="order_file",
        entity_id=str(order_file.id),
        description=f"Загружен файл {file.filename} к заказу {order.order_number}",
    )

    return order_file


@router.delete("/{order_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_file(
    order_id: str,
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Удалить файл заказа.
    """
    order_file = db.query(OrderFile).filter(
        OrderFile.id == file_id,
        OrderFile.order_id == order_id
    ).first()
    if not order_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    # Проверка прав (только manager/admin или владелец файла)
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
        if order_file.uploaded_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Доступ запрещён"
            )

    db.delete(order_file)
    db.commit()

    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="delete_file",
        entity_type="order_file",
        entity_id=str(file_id),
        description=f"Удалён файл {order_file.file_name}",
    )

    return None
