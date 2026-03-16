import os
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_roles
from app.db.session import get_db
from app.models import (
    Order,
    OrderFile,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    PaymentType,
    Service,
    User,
    UserRole,
    Client,
)
from app.schemas import (
    OrderCreate,
    OrderOut,
    OrderStatusUpdate,
    OrderAssignRequest,
    OrderUpdate,
)


router = APIRouter(prefix="/api/orders", tags=["orders"])

UPLOAD_DIR = "app/uploads/orders"


def _calculate_loyalty_tier(total_orders: int, loyalty_points: int) -> str:
    """Определяет уровень лояльности клиента."""
    if total_orders >= 10 or loyalty_points >= 1000:
        return "gold"
    elif total_orders >= 5 or loyalty_points >= 500:
        return "silver"
    return "bronze"


def _calculate_discount(client: Client) -> float:
    """Вычисляет процент скидки на основе уровня лояльности."""
    tier_discounts = {
        "bronze": 0,
        "silver": 5,
        "gold": 10,
    }
    return tier_discounts.get(client.loyalty_tier, 0)


def _get_or_create_client_profile(db: Session, user_id: int) -> Client:
    """Получает или создаёт профиль клиента."""
    client = db.query(Client).filter(Client.user_id == user_id).first()
    if not client:
        client = Client(user_id=user_id)
        db.add(client)
        db.commit()
        db.refresh(client)
    return client


@router.post("", response_model=OrderOut)
async def create_order(
    order: OrderCreate,
    current_user: User = Depends(require_roles([UserRole.LEGAL_CLIENT, UserRole.INDIVIDUAL_CLIENT])),
    db: Session = Depends(get_db),
):
    """
    Создание заказа клиентом.
    - Вычисляет total_price
    - Применяет скидку клиента
    - Записывает order_items
    - Создаёт первую запись в order_status_history
    """
    # Получаем или создаём профиль клиента
    client_profile = _get_or_create_client_profile(db, current_user.id)
    
    # Генерируем номер заказа
    order_count = db.query(Order).count() + 1
    order_number = f"ORD-{datetime.now().strftime('%Y%m%d')}-{order_count:04d}"

    # Создаём заказ
    new_order = Order(
        order_number=order_number,
        client_id=current_user.id,
        payment_type=order.payment_type,
        notes=order.notes,
        status=OrderStatus.PENDING,
        total_price=0,
    )
    db.add(new_order)
    db.flush()

    # Добавляем элементы заказа
    total = 0
    for item in order.items:
        service = db.query(Service).filter(Service.id == item.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail=f"Service {item.service_id} not found")
        
        order_item = OrderItem(
            order_id=new_order.id,
            service_id=item.service_id,
            quantity=item.quantity,
            unit_price=service.base_price,
            specifications=item.specifications,
        )
        db.add(order_item)
        total += service.base_price * item.quantity

    # Применяем скидку клиента
    discount = _calculate_discount(client_profile)
    final_total = total * (1 - discount / 100)
    new_order.total_price = final_total

    db.commit()
    db.refresh(new_order)

    # Создаём первую запись в истории статусов
    status_history = OrderStatusHistory(
        order_id=new_order.id,
        old_status=None,
        new_status=OrderStatus.PENDING,
        comment="Order created",
        changed_by=current_user.id,
    )
    db.add(status_history)
    db.commit()

    # Возвращаем заказ с элементами
    return db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files)
    ).filter(Order.id == new_order.id).first()


@router.get("", response_model=List[OrderOut])
async def get_orders(
    status: Optional[OrderStatus] = Query(None),
    priority: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    client_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Получение списка заказов с фильтрами.
    - client видит только свои заказы
    - technician видит назначенные
    - manager/admin видят все
    """
    query = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files),
        joinedload(Order.client),
        joinedload(Order.technician)
    )

    # Фильтрация по доступу
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        if current_user.role == UserRole.TECHNICIAN:
            query = query.filter(Order.technician_id == current_user.id)
        else:
            query = query.filter(Order.client_id == current_user.id)
    elif client_id is not None:
        query = query.filter(Order.client_id == client_id)

    # Фильтры
    if status is not None:
        query = query.filter(Order.status == status)
    
    if date_from is not None:
        query = query.filter(Order.created_at >= date_from)
    
    if date_to is not None:
        query = query.filter(Order.created_at <= date_to)

    # Пагинация
    offset = (page - 1) * limit
    orders = query.offset(offset).limit(limit).all()
    
    return orders


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Получение одного заказа с items, files, status_history."""
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files),
        joinedload(Order.client),
        joinedload(Order.technician)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Проверка доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        if order.client_id != current_user.id and order.technician_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    return order


@router.put("/{order_id}", response_model=OrderOut)
async def update_order(
    order_id: int,
    order_update: OrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Обновление заказа.
    Клиент может редактировать только при status='new' (PENDING).
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Проверка: клиент может редактировать только в статусе PENDING
    if current_user.role in [UserRole.LEGAL_CLIENT, UserRole.INDIVIDUAL_CLIENT]:
        if order.status != OrderStatus.PENDING:
            raise HTTPException(
                status_code=403,
                detail="Client can only edit orders in PENDING status"
            )
        if order.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your order")

    # Проверка для других ролей
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Обновление полей
    update_data = order_update.dict(exclude_unset=True)
    if "notes" in update_data:
        order.notes = update_data["notes"]
    
    # Обновление элементов заказа (если предоставлены)
    if "items" in update_data and order_update.items:
        # Удаляем старые элементы
        db.query(OrderItem).filter(OrderItem.order_id == order_id).delete()
        
        # Добавляем новые
        total = 0
        for item in order_update.items:
            service = db.query(Service).filter(Service.id == item.service_id).first()
            if not service:
                raise HTTPException(status_code=404, detail=f"Service {item.service_id} not found")
            
            order_item = OrderItem(
                order_id=order.id,
                service_id=item.service_id,
                quantity=item.quantity,
                unit_price=service.base_price,
                specifications=item.specifications,
            )
            db.add(order_item)
            total += service.base_price * item.quantity
        
        order.total_price = total

    db.commit()
    db.refresh(order)
    
    return db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files)
    ).filter(Order.id == order.id).first()


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    current_user: User = Depends(require_roles([
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.TECHNICIAN
    ])),
    db: Session = Depends(get_db),
):
    """
    Обновление статуса заказа.
    - Записывает в order_status_history
    - При status='completed': обновляет clients.total_orders,
      пересчитывает loyalty_tier, начисляет loyalty_points
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    new_status = status_update.new_status

    # Обновляем статус
    order.status = new_status

    # Обновляем временные метки в зависимости от статуса
    now = datetime.utcnow()
    if new_status == OrderStatus.APPROVED:
        order.approved_at = now
        order.rejection_message = None
    elif new_status == OrderStatus.COMPLETED:
        order.completed_at = now
        
        # Обновляем профиль клиента
        client_profile = db.query(Client).filter(Client.user_id == order.client_id).first()
        if client_profile:
            # Увеличиваем счётчик заказов
            client_profile.total_orders += 1
            
            # Начисляем loyalty points (10% от суммы заказа)
            points_earned = int(order.total_price * 0.1)
            client_profile.loyalty_points += points_earned
            
            # Пересчитываем уровень лояльности
            client_profile.loyalty_tier = _calculate_loyalty_tier(
                client_profile.total_orders,
                client_profile.loyalty_points
            )
            
            # Обновляем скидку
            client_profile.discount_percent = _calculate_discount(client_profile)

    db.commit()

    # Записываем в историю статусов
    status_history = OrderStatusHistory(
        order_id=order.id,
        old_status=old_status,
        new_status=new_status,
        comment=status_update.comment,
        changed_by=current_user.id,
    )
    db.add(status_history)
    db.commit()

    # Возвращаем обновлённый заказ
    return db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files)
    ).filter(Order.id == order.id).first()


@router.patch("/{order_id}/assign", response_model=OrderOut)
async def assign_order(
    order_id: int,
    assign_request: OrderAssignRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER])),
    db: Session = Depends(get_db),
):
    """Назначение исполнителя на заказ (только manager/admin)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Проверяем существование техника
    technician = db.query(User).filter(
        User.id == assign_request.technician_id,
        User.role == UserRole.TECHNICIAN
    ).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")

    order.technician_id = assign_request.technician_id
    db.commit()

    # Записываем в историю
    status_history = OrderStatusHistory(
        order_id=order.id,
        old_status=order.status,
        new_status=order.status,
        comment=f"Assigned to technician {technician.full_name}",
        changed_by=current_user.id,
    )
    db.add(status_history)
    db.commit()

    return db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.status_history),
        joinedload(Order.files)
    ).filter(Order.id == order.id).first()


@router.post("/{order_id}/files")
async def upload_order_file(
    order_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Загрузка файла к заказу."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Проверка доступа
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]:
        if order.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    # Создаём директорию если не существует
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Генерируем уникальное имя файла
    file_extension = file.filename.split(".")[-1] if "." in file.filename else ""
    unique_filename = f"{uuid.uuid4()}.{file_extension}" if file_extension else uuid.uuid4().hex
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Сохраняем файл
    file_size = 0
    with open(file_path, "wb") as buffer:
        content = await file.read()
        file_size = len(content)
        buffer.write(content)

    # Создаём запись в БД
    order_file = OrderFile(
        order_id=order.id,
        file_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        uploaded_by=current_user.id,
    )
    db.add(order_file)
    db.commit()
    db.refresh(order_file)

    return {
        "id": order_file.id,
        "file_name": order_file.file_name,
        "file_path": order_file.file_path,
        "file_size": order_file.file_size,
        "uploaded_at": order_file.uploaded_at,
    }


@router.delete("/{order_id}/files/{file_id}")
async def delete_order_file(
    order_id: int,
    file_id: int,
    current_user: User = Depends(require_roles([
        UserRole.ADMIN,
        UserRole.MANAGER,
        UserRole.TECHNICIAN
    ])),
    db: Session = Depends(get_db),
):
    """Удаление файла заказа."""
    order_file = db.query(OrderFile).filter(
        OrderFile.id == file_id,
        OrderFile.order_id == order_id
    ).first()
    
    if not order_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Удаляем файл с диска
    if os.path.exists(order_file.file_path):
        os.remove(order_file.file_path)

    # Удаляем запись из БД
    db.delete(order_file)
    db.commit()

    return {"message": "File deleted successfully"}


@router.get("/{order_id}/files/{file_id}")
async def download_order_file(
    order_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Скачивание файла заказа."""
    order_file = db.query(OrderFile).filter(
        OrderFile.id == file_id,
        OrderFile.order_id == order_id
    ).first()
    
    if not order_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Проверка доступа
    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]:
        if order.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

    if not os.path.exists(order_file.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        order_file.file_path,
        filename=order_file.file_name,
        media_type="application/octet-stream",
    )
