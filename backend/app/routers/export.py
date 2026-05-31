"""
Роутеры для экспорта отчётов (Word/DOCX, Excel/XLSX).
"""
from datetime import date as date_type
from datetime import datetime, time
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies.auth import require_roles
from ..models.client import Client
from ..models.order import Order, OrderItem, OrderStatus, MaterialRequest
from ..models.material import Material
from ..models.technician import Technician
from ..models.user import User, UserRole
from ..utils.export import generate_docx, generate_excel

router = APIRouter(prefix="/export", tags=["export"])

EXPORT_MAX_ROWS = 5000
VALID_STATUSES = ["new", "confirmed", "in_progress", "review", "completed", "cancelled", "archived"]
VALID_PRIORITIES = ["normal", "urgent", "critical"]

FILTER_LABELS_RU = {
    "date_from": "Дата создания от",
    "date_to": "Дата создания до",
    "status": "Статус",
    "priority": "Приоритет",
    "client_id": "ID клиента",
    "technician_id": "ID техника",
    "search": "Поиск",
}


def _parse_date_range(date_from: Optional[date_type], date_to: Optional[date_type]) -> Dict[str, Any]:
    return {
        "date_from": date_from.isoformat() if date_from else None,
        "date_to": date_to.isoformat() if date_to else None,
    }


def _filters_for_report(**kwargs: Any) -> Dict[str, Any]:
    """Человекочитаемые подписи фильтров в шапке отчёта."""
    result: Dict[str, Any] = {}
    for key, value in kwargs.items():
        if value is None or value == "" or value == []:
            continue
        label = FILTER_LABELS_RU.get(key, key)
        result[label] = value
    return result


def _normalize_status_filter(
    status_filter: Optional[Union[str, List[str]]],
) -> Optional[List[str]]:
    if not status_filter:
        return None
    if isinstance(status_filter, list):
        raw = status_filter
    else:
        raw = [status_filter]
    result: List[str] = []
    for item in raw:
        for part in str(item).split(","):
            part = part.strip()
            if part:
                result.append(part)
    return result or None


def _apply_order_filters(
    query,
    *,
    status_filter: Optional[List[str]] = None,
    priority: Optional[str] = None,
    date_from: Optional[date_type] = None,
    date_to: Optional[date_type] = None,
    client_id: Optional[int] = None,
    technician_id: Optional[int] = None,
    search: Optional[str] = None,
):
    if status_filter:
        for s in status_filter:
            if s not in VALID_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Недопустимый статус: {s}. Допустимые: {', '.join(VALID_STATUSES)}",
                )
        query = query.filter(Order.status.in_(status_filter))

    if priority:
        if priority not in VALID_PRIORITIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимый приоритет. Допустимые: {', '.join(VALID_PRIORITIES)}",
            )
        query = query.filter(Order.priority == priority)

    if date_from:
        query = query.filter(Order.created_at >= datetime.combine(date_from, time.min))

    if date_to:
        query = query.filter(Order.created_at <= datetime.combine(date_to, datetime.max.time()))

    if client_id is not None:
        query = query.filter(Order.client_id == client_id)

    if technician_id is not None:
        query = query.filter(Order.technician_id == technician_id)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Order.order_number.ilike(pattern),
                Order.client.has(
                    or_(
                        Client.clinic_name.ilike(pattern),
                        Client.user.has(
                            or_(
                                User.first_name.ilike(pattern),
                                User.last_name.ilike(pattern),
                                User.email.ilike(pattern),
                            )
                        ),
                    )
                ),
            )
        )

    return query


def _fetch_for_export(query, page: int, limit: int):
    export_limit = min(max(limit, 1), EXPORT_MAX_ROWS)
    offset = (max(page, 1) - 1) * export_limit
    return query.offset(offset).limit(export_limit).all()


def _require_format(format: str) -> str:
    if format not in {"excel", "docx"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживаемые форматы: excel, docx",
        )
    return format


@router.get(
    "/orders",
    responses={200: {"content": {"application/octet-stream": {}}}},
    response_model=None,
)
async def export_orders(
    status_filter: Optional[List[str]] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    client_id: Optional[int] = Query(None),
    technician_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    format: str = Query("excel"),
    page: int = Query(1, ge=1),
    limit: int = Query(5000, ge=1, le=EXPORT_MAX_ROWS),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin", "client", "technician"])),
):
    """
    Экспорт отчёта по заказам.
    Роли:
    - manager/admin: все заказы (с фильтрами)
    - client: только свои заказы
    - technician: только назначенные ему заказы
    """
    format = _require_format(format)

    status_filter_list = _normalize_status_filter(status_filter)

    filters_for_report = _filters_for_report(
        **_parse_date_range(date_from, date_to),
        status=", ".join(status_filter_list) if status_filter_list else None,
        priority=priority,
        client_id=client_id,
        technician_id=technician_id,
        search=search,
    )

    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        # Order.manager is already a relationship to User; User has no "user" attribute.
        joinedload(Order.manager),
    )

    # Role-based scoping
    if current_user.role == UserRole.CLIENT:
        client_profile = db.query(Client).filter(Client.user_id == current_user.id).first()
        if not client_profile:
            data: List[Dict[str, Any]] = []
        else:
            query = query.filter(Order.client_id == client_profile.id)
            data = []
    elif current_user.role == UserRole.TECHNICIAN:
        tech_profile = db.query(Technician).filter(Technician.user_id == current_user.id).first()
        if not tech_profile:
            data = []
        else:
            query = query.filter(Order.technician_id == tech_profile.id)
            data = []
    else:
        data = []

    scope_client_id = client_id if current_user.role in [UserRole.MANAGER, UserRole.ADMIN] else None
    scope_technician_id = technician_id if current_user.role in [UserRole.MANAGER, UserRole.ADMIN] else None

    query = _apply_order_filters(
        query,
        status_filter=status_filter_list,
        priority=priority,
        date_from=date_from,
        date_to=date_to,
        client_id=scope_client_id,
        technician_id=scope_technician_id,
        search=search if current_user.role in [UserRole.MANAGER, UserRole.ADMIN] else None,
    )

    orders = _fetch_for_export(
        query.order_by(Order.created_at.desc()),
        page,
        limit,
    )

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for o in orders:
        client_name = None
        if o.client and o.client.user:
            client_name = f"{o.client.user.first_name} {o.client.user.last_name}"

        technician_name = None
        if o.technician and o.technician.user:
            technician_name = f"{o.technician.user.first_name} {o.technician.user.last_name}"

        manager_name = None
        if o.manager and getattr(o.manager, "user", None):
            manager_name = f"{o.manager.user.first_name} {o.manager.user.last_name}"

        rows.append(
            {
                "order_number": o.order_number,
                "status": getattr(o.status, "value", o.status),
                "priority": getattr(o.priority, "value", o.priority),
                "client_name": client_name,
                "technician_name": technician_name,
                "manager_name": manager_name,
                "total_price": float(o.total_price) if o.total_price is not None else 0,
                "discount_amount": float(o.discount_amount) if o.discount_amount is not None else 0,
                "final_price": float(o.final_price) if o.final_price is not None else 0,
                "deadline": o.deadline.isoformat() if o.deadline else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        )

    report_title = "Журнал заказов"
    if format == "excel":
        blob = generate_excel(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "zhurnal_zakazov.xlsx"
    else:
        blob = generate_docx(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "zhurnal_zakazov.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/clients", response_model=None, response_class=Response)
async def export_clients(
    format: str = Query("excel"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin", "client", "technician"])),
):
    """
    Экспорт отчёта по клиентам.
    Роли:
    - manager/admin: все клиенты
    - client/technician: только ограниченные данные (свои поля не поддерживаются как “список”, вернём 400)
    """
    format = _require_format(format)

    if current_user.role in [UserRole.CLIENT, UserRole.TECHNICIAN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Экспорт клиентов доступен только manager/admin",
        )

    filters_for_report: Dict[str, Any] = {}

    query = db.query(Client).join(Client.user).options(joinedload(Client.user))
    total = query.count()
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit

    clients = query.order_by(Client.total_orders.desc()).offset(offset).limit(limit).all()

    rows: List[Dict[str, Any]] = []
    for c in clients:
        rows.append(
            {
                "first_name": c.user.first_name if c.user else None,
                "last_name": c.user.last_name if c.user else None,
                "email": c.user.email if c.user else None,
                "phone": c.user.phone if c.user else None,
                "clinic_name": c.clinic_name,
                "address": c.address,
                "loyalty_tier": c.loyalty_tier,
                "discount_percent": c.discount_percent,
                "loyalty_points": c.user.loyalty_points if c.user else None,
                "total_orders": c.total_orders,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Отчёт по клиентам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "clients_report.xlsx"
    else:
        blob = generate_docx(rows, title="Отчёт по клиентам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "clients_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/technicians", response_model=None, response_class=Response)
async def export_technicians(
    format: str = Query("excel"),
    available_only: bool = Query(True),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin", "client", "technician"])),
):
    """
    Экспорт отчёта по техникам.
    Роли:
    - manager/admin: все техники
    - technician: только себя (список из 1)
    - client: 403
    """
    format = _require_format(format)

    filters_for_report: Dict[str, Any] = {"available_only": available_only}

    if current_user.role == UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Экспорт техников доступен не для client",
        )

    query = db.query(Technician).join(Technician.user).options(joinedload(Technician.user))
    if current_user.role == UserRole.TECHNICIAN:
        query = query.filter(Technician.user_id == current_user.id)
    else:
        if available_only:
            query = query.filter(Technician.is_available == True)

    offset = (page - 1) * limit
    technicians = query.order_by(Technician.rating.desc()).offset(offset).limit(limit).all()

    rows: List[Dict[str, Any]] = []
    for t in technicians:
        rows.append(
            {
                "first_name": t.user.first_name if t.user else None,
                "last_name": t.user.last_name if t.user else None,
                "email": t.user.email if t.user else None,
                "phone": t.user.phone if t.user else None,
                "specialization": t.specialization,
                "experience_years": t.experience_years,
                "rating": t.rating,
                "completed_orders": t.completed_orders,
                "is_available": t.is_available,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Отчёт по сотрудникам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "technicians_report.xlsx"
    else:
        blob = generate_docx(rows, title="Отчёт по сотрудникам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "technicians_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/materials", response_model=None, response_class=Response)
async def export_material_requests(
    format: str = Query("excel"),
    status: Optional[str] = Query("pending", description="pending|approved|rejected|issued"),
    date_from=Query(None),
    date_to=Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Экспорт отчёта по заявкам на материалы.
    """
    format = _require_format(format)

    filters_for_report = {
        **_parse_date_range(date_from, date_to),
        "status": status,
    }

    valid_material_statuses = {"pending", "approved", "rejected", "issued"}
    if status and status not in valid_material_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Недопустимый статус заявки на материалы")

    query = (
        db.query(MaterialRequest)
        .join(MaterialRequest.technician)
        .join(MaterialRequest.material)
        .options(
            joinedload(MaterialRequest.technician).joinedload(Technician.user),
            joinedload(MaterialRequest.material),
        )
    )

    if status:
        query = query.filter(MaterialRequest.status == status)

    if date_from:
        query = query.filter(MaterialRequest.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        query = query.filter(MaterialRequest.created_at <= datetime.combine(date_to, datetime.max.time()))

    offset = (page - 1) * limit
    items = query.order_by(MaterialRequest.created_at.desc()).offset(offset).limit(limit).all()

    rows: List[Dict[str, Any]] = []
    for r in items:
        technician_name = None
        if getattr(r, "technician", None) and getattr(r.technician, "user", None):
            technician_name = f"{r.technician.user.first_name} {r.technician.user.last_name}"

        rows.append(
            {
                "technician_name": technician_name,
                "material_name": r.material.name if r.material else None,
                "quantity_requested": float(r.quantity_requested) if r.quantity_requested is not None else 0,
                "status": getattr(r.status, "value", r.status),
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Отчёт по материалам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "materials_report.xlsx"
    else:
        blob = generate_docx(rows, title="Отчёт по материалам", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "materials_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/gantt", response_model=None, response_class=Response)
async def export_gantt(
    format: str = Query("excel"),
    status_filter: Optional[List[str]] = Query(None, alias="status"),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(5000, ge=1, le=EXPORT_MAX_ROWS),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Экспорт данных для Gantt (заказы с дедлайнами).
    """
    format = _require_format(format)

    status_filter_list = _normalize_status_filter(status_filter)
    if not status_filter_list:
        status_filter_list = ["confirmed", "in_progress", "review"]

    filters_for_report = _filters_for_report(
        **_parse_date_range(date_from, date_to),
        status=", ".join(status_filter_list),
        search=search,
    )

    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    )

    query = _apply_order_filters(
        query,
        status_filter=status_filter_list,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    orders = _fetch_for_export(
        query.order_by(Order.deadline.asc().nullslast()),
        page,
        limit,
    )

    rows: List[Dict[str, Any]] = []
    for o in orders:
        client_name = None
        if o.client and o.client.user:
            client_name = f"{o.client.user.first_name} {o.client.user.last_name}"

        technician_name = None
        if o.technician and o.technician.user:
            technician_name = f"{o.technician.user.first_name} {o.technician.user.last_name}"

        manager_name = None
        if o.manager:
            # manager is a User model (first/last name)
            manager_name = f"{o.manager.first_name} {o.manager.last_name}"

        rows.append(
            {
                "order_number": o.order_number,
                "status": getattr(o.status, "value", o.status),
                "priority": getattr(o.priority, "value", o.priority),
                "client_name": client_name,
                "technician_name": technician_name,
                "manager_name": manager_name,
                "deadline": o.deadline.isoformat() if o.deadline else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        )

    report_title = "График сроков выполнения заказов"
    if format == "excel":
        blob = generate_excel(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "grafik_srokov.xlsx"
    else:
        blob = generate_docx(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "grafik_srokov.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/orders-by-client", response_model=None, response_class=Response)
async def export_orders_by_client(
    format: str = Query("excel"),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    status_filter: Optional[List[str]] = Query(None, alias="status"),
    search: Optional[str] = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(5000, ge=1, le=EXPORT_MAX_ROWS),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Экспорт отчёта по заказам, сгруппированным по клиентам.
    """
    format = _require_format(format)

    status_filter_list = _normalize_status_filter(status_filter)

    filters_for_report = _filters_for_report(
        **_parse_date_range(date_from, date_to),
        status=", ".join(status_filter_list) if status_filter_list else None,
        search=search,
    )

    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    )

    query = _apply_order_filters(
        query,
        status_filter=status_filter_list,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    orders = _fetch_for_export(
        query.order_by(Order.created_at.desc()),
        page,
        limit,
    )

    # Group orders by client and calculate totals
    client_orders_map = {}
    for o in orders:
        client_id = o.client.id if o.client else None
        if client_id not in client_orders_map:
            client_name = None
            if o.client and o.client.user:
                client_name = f"{o.client.user.first_name} {o.client.user.last_name}"
            
            client_orders_map[client_id] = {
                "client_id": client_id,
                "client_name": client_name,
                "clinic_name": o.client.clinic_name if o.client else None,
                "email": o.client.user.email if o.client and o.client.user else None,
                "phone": o.client.user.phone if o.client and o.client.user else None,
                "total_orders": 0,
                "total_paid": 0.0,
                "avg_order_value": 0.0,
                "earliest_deadline": None,
                "latest_deadline": None,
                "orders_count": 0,
                "completed_orders": 0,
                "active_orders": 0,
                "orders": []
            }
        
        client_data = client_orders_map[client_id]
        client_data["total_orders"] += 1
        client_data["total_paid"] += float(o.final_price) if o.final_price is not None else 0
        client_data["orders_count"] += 1
        
        # Track order statuses
        if o.status == OrderStatus.COMPLETED:
            client_data["completed_orders"] += 1
        else:
            client_data["active_orders"] += 1
        
        # Track deadlines
        if o.deadline:
            if not client_data["earliest_deadline"] or (o.deadline and o.deadline < client_data["earliest_deadline"]):
                client_data["earliest_deadline"] = o.deadline
            if not client_data["latest_deadline"] or (o.deadline and o.deadline > client_data["latest_deadline"]):
                client_data["latest_deadline"] = o.deadline
        
        # Add order details
        technician_name = None
        if o.technician and o.technician.user:
            technician_name = f"{o.technician.user.first_name} {o.technician.user.last_name}"
        
        manager_name = None
        if o.manager:
            manager_name = f"{o.manager.first_name} {o.manager.last_name}"
        
        client_data["orders"].append({
            "order_number": o.order_number,
            "status": getattr(o.status, "value", o.status),
            "total_price": float(o.total_price) if o.total_price is not None else 0,
            "discount_amount": float(o.discount_amount) if o.discount_amount is not None else 0,
            "final_price": float(o.final_price) if o.final_price is not None else 0,
            "deadline": o.deadline.isoformat() if o.deadline else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "technician_name": technician_name,
        })

    # Calculate averages and prepare final rows
    rows: List[Dict[str, Any]] = []
    for client_data in client_orders_map.values():
        if client_data["orders_count"] > 0:
            client_data["avg_order_value"] = client_data["total_paid"] / client_data["orders_count"]
        
        row = {
            "client_name": client_data["client_name"],
            "clinic_name": client_data["clinic_name"],
            "email": client_data["email"],
            "total_orders": client_data["orders_count"],
            "total_paid": client_data["total_paid"],
            "avg_order_value": round(client_data["avg_order_value"], 2),
            "completed_orders": client_data["completed_orders"],
            "active_orders": client_data["active_orders"],
            "earliest_deadline": client_data["earliest_deadline"].isoformat() if client_data["earliest_deadline"] else None,
            "latest_deadline": client_data["latest_deadline"].isoformat() if client_data["latest_deadline"] else None,
        }
        rows.append(row)

    report_title = "Сводка заказов по клиентам"
    if format == "excel":
        blob = generate_excel(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "zakazy_po_klientam.xlsx"
    else:
        blob = generate_docx(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "zakazy_po_klientam.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/orders-by-technician", response_model=None, response_class=Response)
async def export_orders_by_technician(
    format: str = Query("excel"),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    status_filter: Optional[List[str]] = Query(None, alias="status"),
    search: Optional[str] = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(5000, ge=1, le=EXPORT_MAX_ROWS),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["manager", "admin"])),
):
    """
    Экспорт отчёта по заказам, сгруппированным по техникам.
    """
    format = _require_format(format)

    status_filter_list = _normalize_status_filter(status_filter)

    filters_for_report = _filters_for_report(
        **_parse_date_range(date_from, date_to),
        status=", ".join(status_filter_list) if status_filter_list else None,
        search=search,
    )

    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    )

    query = _apply_order_filters(
        query,
        status_filter=status_filter_list,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    orders = _fetch_for_export(
        query.order_by(Order.created_at.desc()),
        page,
        limit,
    )

    # Group orders by technician and calculate totals
    tech_orders_map = {}
    for o in orders:
        tech_id = o.technician.id if o.technician else None
        if tech_id and tech_id not in tech_orders_map:
            tech_name = None
            if o.technician and o.technician.user:
                tech_name = f"{o.technician.user.first_name} {o.technician.user.last_name}"
            
            tech_orders_map[tech_id] = {
                "technician_id": tech_id,
                "technician_name": tech_name,
                "specialization": o.technician.specialization if o.technician else None,
                "email": o.technician.user.email if o.technician and o.technician.user else None,
                "total_orders": 0,
                "total_earned": 0.0,
                "avg_order_value": 0.0,
                "earliest_deadline": None,
                "latest_deadline": None,
                "orders_count": 0,
                "completed_orders": 0,
                "active_orders": 0,
                "orders": []
            }
        elif not tech_id:
            # Skip orders without technicians
            continue
        
        tech_data = tech_orders_map[tech_id]
        tech_data["total_orders"] += 1
        tech_data["total_earned"] += float(o.final_price) if o.final_price is not None else 0
        tech_data["orders_count"] += 1
        
        # Track order statuses
        if o.status == OrderStatus.COMPLETED:
            tech_data["completed_orders"] += 1
        else:
            tech_data["active_orders"] += 1
        
        # Track deadlines
        if o.deadline:
            if not tech_data["earliest_deadline"] or (o.deadline and o.deadline < tech_data["earliest_deadline"]):
                tech_data["earliest_deadline"] = o.deadline
            if not tech_data["latest_deadline"] or (o.deadline and o.deadline > tech_data["latest_deadline"]):
                tech_data["latest_deadline"] = o.deadline
        
        # Add order details
        client_name = None
        if o.client and o.client.user:
            client_name = f"{o.client.user.first_name} {o.client.user.last_name}"
        
        manager_name = None
        if o.manager:
            manager_name = f"{o.manager.first_name} {o.manager.last_name}"
        
        tech_data["orders"].append({
            "order_number": o.order_number,
            "status": getattr(o.status, "value", o.status),
            "total_price": float(o.total_price) if o.total_price is not None else 0,
            "discount_amount": float(o.discount_amount) if o.discount_amount is not None else 0,
            "final_price": float(o.final_price) if o.final_price is not None else 0,
            "deadline": o.deadline.isoformat() if o.deadline else None,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "client_name": client_name,
        })

    # Calculate averages and prepare final rows
    rows: List[Dict[str, Any]] = []
    for tech_data in tech_orders_map.values():
        if tech_data["orders_count"] > 0:
            tech_data["avg_order_value"] = tech_data["total_earned"] / tech_data["orders_count"]
        
        row = {
            "technician_name": tech_data["technician_name"],
            "specialization": tech_data["specialization"],
            "email": tech_data["email"],
            "total_orders": tech_data["orders_count"],
            "total_earned": tech_data["total_earned"],
            "avg_order_value": round(tech_data["avg_order_value"], 2),
            "completed_orders": tech_data["completed_orders"],
            "active_orders": tech_data["active_orders"],
            "earliest_deadline": tech_data["earliest_deadline"].isoformat() if tech_data["earliest_deadline"] else None,
            "latest_deadline": tech_data["latest_deadline"].isoformat() if tech_data["latest_deadline"] else None,
        }
        rows.append(row)

    report_title = "Сводка заказов по исполнителям"
    if format == "excel":
        blob = generate_excel(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "zakazy_po_ispolnitelyam.xlsx"
    else:
        blob = generate_docx(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "zakazy_po_ispolnitelyam.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/technician-orders", response_model=None, response_class=Response)
async def export_technician_orders(
    format: str = Query("excel"),
    status_filter: Optional[List[str]] = Query(None, alias="status"),
    date_from: Optional[date_type] = Query(None),
    date_to: Optional[date_type] = Query(None),
    search: Optional[str] = Query(None, min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(5000, ge=1, le=EXPORT_MAX_ROWS),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["technician"])),
):
    """
    Экспорт отчёта по заказам техника.
    Только для техников - показывает их собственные заказы.
    """
    format = _require_format(format)

    status_filter_list = _normalize_status_filter(status_filter)

    filters_for_report = _filters_for_report(
        **_parse_date_range(date_from, date_to),
        status=", ".join(status_filter_list) if status_filter_list else None,
        search=search,
    )

    # Find technician profile for current user
    technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль техника не найден",
        )

    query = db.query(Order).options(
        joinedload(Order.client).joinedload(Client.user),
        joinedload(Order.technician).joinedload(Technician.user),
        joinedload(Order.manager),
    ).filter(Order.technician_id == technician.id)

    query = _apply_order_filters(
        query,
        status_filter=status_filter_list,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    orders = _fetch_for_export(
        query.order_by(Order.created_at.desc()),
        page,
        limit,
    )

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for o in orders:
        client_name = None
        if o.client and o.client.user:
            client_name = f"{o.client.user.first_name} {o.client.user.last_name}"

        technician_name = None
        if o.technician and o.technician.user:
            technician_name = f"{o.technician.user.first_name} {o.technician.user.last_name}"

        manager_name = None
        if o.manager:
            manager_name = f"{o.manager.first_name} {o.manager.last_name}"

        rows.append(
            {
                "order_number": o.order_number,
                "status": getattr(o.status, "value", o.status),
                "priority": getattr(o.priority, "value", o.priority),
                "client_name": client_name,
                "technician_name": technician_name,
                "manager_name": manager_name,
                "total_price": float(o.total_price) if o.total_price is not None else 0,
                "discount_amount": float(o.discount_amount) if o.discount_amount is not None else 0,
                "final_price": float(o.final_price) if o.final_price is not None else 0,
                "deadline": o.deadline.isoformat() if o.deadline else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "completed_at": o.completed_at.isoformat() if o.completed_at else None,
            }
        )

    report_title = "Мои заказы — выгрузка"
    if format == "excel":
        blob = generate_excel(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "moi_zakazy.xlsx"
    else:
        blob = generate_docx(rows, title=report_title, filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "moi_zakazy.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/users", response_model=None, response_class=Response)
async def export_users(
    format: str = Query("excel"),
    role=Query(None),
    is_active=Query(None, description="true|false"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Экспорт списка пользователей.
    Только для администраторов.
    """
    format = _require_format(format)

    filters_for_report = {
        "role": role,
        "is_active": is_active,
    }

    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        active_bool = is_active.lower() == "true"
        query = query.filter(User.is_active == active_bool)

    offset = (page - 1) * limit
    users = query.offset(offset).limit(limit).all()

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for u in users:
        rows.append(
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role.value if hasattr(u.role, 'value') else u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "updated_at": u.updated_at.isoformat() if u.updated_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Пользователи системы", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "users_report.xlsx"
    else:
        blob = generate_docx(rows, title="Пользователи системы", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "users_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/faqs", response_model=None, response_class=Response)
async def export_faqs(
    format: str = Query("excel"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Экспорт списка FAQ.
    Только для администраторов.
    """
    format = _require_format(format)

    filters_for_report = {}

    from ..models.faq import Faq
    query = db.query(Faq)

    offset = (page - 1) * limit
    faqs = query.offset(offset).limit(limit).all()

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for f in faqs:
        rows.append(
            {
                "id": f.id,
                "question": f.question,
                "answer": f.answer,
                "category": f.category,
                "sort_order": f.sort_order,
                "is_published": f.is_published,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="ЧаВо", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "faqs_report.xlsx"
    else:
        blob = generate_docx(rows, title="ЧаВо", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "faqs_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/reviews", response_model=None, response_class=Response)
async def export_reviews(
    format: str = Query("excel"),
    is_published=Query(None, description="true|false"),
    is_moderated=Query(None, description="true|false"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Экспорт списка отзывов.
    Только для администраторов.
    """
    format = _require_format(format)

    filters_for_report = {
        "is_published": is_published,
        "is_moderated": is_moderated,
    }

    from ..models.review import Review
    query = db.query(Review).options(joinedload(Review.client).joinedload(Client.user))

    if is_published is not None:
        published_bool = is_published.lower() == "true"
        query = query.filter(Review.is_published == published_bool)
    if is_moderated is not None:
        moderated_bool = is_moderated.lower() == "true"
        query = query.filter(Review.is_moderated == moderated_bool)

    offset = (page - 1) * limit
    reviews = query.offset(offset).limit(limit).all()

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for r in reviews:
        client_name = None
        if r.client and r.client.user:
            client_name = f"{r.client.user.first_name} {r.client.user.last_name}"

        rows.append(
            {
                "id": r.id,
                "client_name": client_name,
                "order_id": r.order_id,
                "rating": r.rating,
                "text": r.text,
                "is_moderated": r.is_moderated,
                "is_published": r.is_published,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                # Note: Review model doesn't have updated_at field
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Отзывы", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "reviews_report.xlsx"
    else:
        blob = generate_docx(rows, title="Отзывы", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "reviews_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)


@router.get("/articles", response_model=None, response_class=Response)
async def export_articles(
    format: str = Query("excel"),
    is_published=Query(None, description="true|false"),
    category=Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Экспорт списка статей.
    Только для администраторов.
    """
    format = _require_format(format)

    filters_for_report = {
        "is_published": is_published,
        "category": category,
    }

    from ..models.article import Article
    query = db.query(Article)

    if is_published is not None:
        published_bool = is_published.lower() == "true"
        query = query.filter(Article.is_published == published_bool)
    if category:
        query = query.filter(Article.category == category)

    offset = (page - 1) * limit
    articles = query.offset(offset).limit(limit).all()

    # Shape data for export
    rows: List[Dict[str, Any]] = []
    for a in articles:
        rows.append(
            {
                "id": a.id,
                "title": a.title,
                "slug": a.slug,
                "category": a.category,
                "is_published": a.is_published,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
        )

    if format == "excel":
        blob = generate_excel(rows, title="Статьи", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "articles_report.xlsx"
    else:
        blob = generate_docx(rows, title="Статьи", filters=filters_for_report)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = "articles_report.docx"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=blob.getvalue(), media_type=media_type, headers=headers)
