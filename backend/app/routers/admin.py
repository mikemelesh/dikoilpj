"""
Роутеры для администрирования.
"""
import math
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..dependencies.auth import get_current_active_user, require_roles
from ..models.logging import ActionLog
from ..models.user import User, UserRole
from ..schemas.secondary import (
    ActionLogListResponse,
    ActionLogResponse,
    BackupResponse,
    UserListResponse,
    UserRoleUpdate,
    UserStatusUpdate,
    UserSummaryResponse,
)
from ..utils.security import log_action

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=ActionLogListResponse)
async def get_action_logs(
    user_id: Optional[str] = Query(None, description="Фильтр по пользователю"),
    action_type: Optional[str] = Query(None, description="Фильтр по типу действия"),
    date_from: Optional[datetime] = Query(None, description="Дата начала"),
    date_to: Optional[datetime] = Query(None, description="Дата окончания"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Получить логи действий пользователей.
    Доступно: admin.
    """
    import uuid
    from ..models.logging import ActionLog

    query = db.query(ActionLog).options(
        joinedload(ActionLog.user)
    )

    # Фильтры
    if user_id:
        # Проверяем, является ли user_id корректным UUID
        try:
            uuid.UUID(user_id)
            query = query.filter(ActionLog.user_id == user_id)
        except ValueError:
            # Если не UUID, ищем по email
            query = query.join(ActionLog.user).filter(User.email.ilike(f"%{user_id}%"))
    
    if action_type:
        query = query.filter(ActionLog.action_type == action_type)
    if date_from:
        query = query.filter(ActionLog.created_at >= date_from)
    if date_to:
        query = query.filter(ActionLog.created_at <= date_to)

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    logs = query.order_by(ActionLog.created_at.desc()).offset(offset).limit(limit).all()

    items = [
        ActionLogResponse(
            id=log.id,
            user_id=str(log.user_id) if log.user_id else None,
            user_email=log.user.email if log.user else None,
            action_type=log.action_type,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            description=log.description,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]

    return ActionLogListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.get("/users", response_model=UserListResponse)
async def get_all_users(
    search: Optional[str] = Query(None, min_length=1, description="Поиск по имени и email"),
    role: Optional[str] = Query(None, description="Фильтр по роли"),
    is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
    sort_by: Optional[str] = Query(
        "created_at",
        description="Поле сортировки: name|email|role|is_active|created_at",
    ),
    sort_dir: Optional[str] = Query(
        "desc",
        description="Направление сортировки: asc|desc",
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Получить список всех пользователей.
    Доступно: admin, manager.
    """
    from sqlalchemy import or_
    
    query = db.query(User)

    # Поиск по имени и email
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_pattern),
                User.first_name.ilike(search_pattern),
                User.last_name.ilike(search_pattern),
            )
        )

    # Фильтры
    if role:
        valid_roles = ["guest", "client", "technician", "manager", "admin"]
        if role.lower() not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимая роль. Допустимые: {', '.join(valid_roles)}"
            )
        query = query.filter(User.role == role.lower())

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # Сортировка (safe whitelist)
    sort_by = (sort_by or "created_at").lower()
    sort_dir = (sort_dir or "desc").lower()
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort_dir должен быть asc или desc",
        )

    # name: first_name + ' ' + last_name (safe for NULLs)
    # Use Postgres concatenation operator (||) instead of func.concat for better compatibility.
    # NOTE: use sqlalchemy.literal(), not func.literal().
    from sqlalchemy import literal

    name_expr = (
        func.coalesce(User.first_name, "")
        .op("||")(literal(" "))
        .op("||")(func.coalesce(User.last_name, ""))
    )

    sort_map = {
        "name": name_expr,
        "email": User.email,
        "role": User.role,
        "is_active": User.is_active,
        "created_at": User.created_at,
    }

    sort_col = sort_map.get(sort_by)
    if sort_col is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимое значение sort_by",
        )

    # nulls to the end
    # (SQLAlchemy supports NULLS LAST for Postgres; if expression doesn't support it, it will still fall back safely)
    if sort_dir == "asc":
        order = sort_col.asc().nulls_last()
    else:
        order = sort_col.desc().nulls_last()

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    users = query.order_by(order).offset(offset).limit(limit).all()

    items = [
        UserSummaryResponse(
            id=str(u.id),
            email=u.email,
            first_name=u.first_name,
            last_name=u.last_name,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]

    return UserListResponse(items=items, total=total, page=page, limit=limit, pages=pages)


@router.patch("/users/{user_id}/role", response_model=UserSummaryResponse)
async def update_user_role(
    user_id: str,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Изменить роль пользователя.
    Доступно: admin, manager (менеджер не может назначать admin).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    new_role = role_data.role.lower()
    if current_user.role == UserRole.MANAGER:
        if new_role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Менеджер не может назначать роль администратора",
            )
        if user.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нельзя изменять учётную запись администратора",
            )
    
    # Нельзя изменить роль админа (защита)
    if user.role == UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя изменить роль другого администратора"
        )
    
    # Валидация роли
    valid_roles = ["guest", "client", "technician", "manager", "admin"]
    if new_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимая роль. Допустимые: {', '.join(valid_roles)}"
        )
    
    old_role = user.role
    user.role = new_role
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_user_role",
        entity_type="user",
        entity_id=user_id,
        description=f"Роль пользователя {user.email} изменена: {old_role} → {new_role}",
    )
    
    return UserSummaryResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.patch("/users/{user_id}/status", response_model=UserSummaryResponse)
async def update_user_status(
    user_id: str,
    status_data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "manager"])),
):
    """
    Активировать/деактивировать пользователя.
    Доступно: admin, manager (не для учёток admin).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    if current_user.role == UserRole.MANAGER and user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя изменять учётную запись администратора",
        )
    
    # Нельзя деактивировать себя
    if user.id == current_user.id and not status_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя деактивировать самого себя"
        )
    
    # Нельзя деактивировать последнего админа
    if user.role == UserRole.ADMIN and not status_data.is_active:
        admin_count = db.query(func.count(User.id)).filter(
            User.role == UserRole.ADMIN,
            User.is_active == True,
            User.id != user_id,
        ).scalar()
        if admin_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя деактивировать последнего администратора"
            )
    
    old_status = user.is_active
    user.is_active = status_data.is_active
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    log_action(
        db=db,
        user_id=str(current_user.id),
        action_type="update_user_status",
        entity_type="user",
        entity_id=user_id,
        description=f"Статус пользователя {user.email} изменён: {'активен' if old_status else 'неактивен'} → {'активен' if status_data.is_active else 'неактивен'}",
    )
    
    return UserSummaryResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/backup", response_model=BackupResponse)
async def create_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Создать дамп базы данных.
    Доступно: admin.
    """
    import shutil
    import subprocess

    # Создаём директорию для бэкапов
    backup_dir = Path(settings.BASE_DIR.parent) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # Генерируем имя файла
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.sql"
    filepath = backup_dir / filename

    # Проверяем наличие pg_dump
    pg_dump_path = shutil.which("pg_dump")
    if not pg_dump_path:
        # Пробуем стандартные пути установки PostgreSQL на Windows
        possible_paths = [
            r"C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
            r"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
            r"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        ]
        for path in possible_paths:
            if Path(path).exists():
                pg_dump_path = path
                break

    if not pg_dump_path:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="pg_dump не найден. Убедитесь, что PostgreSQL установлен и pg_dump доступен в PATH."
        )

    # Получаем параметры подключения из DSN
    db_url = settings.SQLALCHEMY_DATABASE_URL
    try:
        # Парсим DSN (формат: postgresql+psycopg2://user:pass@host:port/dbname)
        # Удаляем префикс
        db_url_clean = db_url.replace("postgresql+psycopg://", "").replace("postgresql+psycopg2://", "")
        
        # Разделяем user:pass и host:port/dbname
        if "@" in db_url_clean:
            user_pass, host_db = db_url_clean.split("@", 1)
        else:
            host_db = db_url_clean
            user_pass = ""
        
        # Парсим user:pass
        if ":" in user_pass:
            user, password = user_pass.split(":", 1)
        else:
            user = user_pass
            password = ""
        
        # Парсим host:port/dbname
        if "/" in host_db:
            host_port, dbname = host_db.rsplit("/", 1)
        else:
            raise ValueError("Некорректный формат DSN: отсутствует имя базы данных")
        
        # Парсим host:port
        if ":" in host_port:
            host, port = host_port.rsplit(":", 1)
        else:
            host = host_port
            port = "5432"

        # Формируем команду pg_dump
        cmd = [
            pg_dump_path,
            "-h", host,
            "-p", port,
            "-U", user,
            "-d", dbname,
            "-F", "p",  # Plain text format
            "-f", str(filepath),
        ]

        # Выполняем команду
        env = os.environ.copy()
        env["PGPASSWORD"] = password

        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            error_detail = result.stderr or result.stdout or "Неизвестная ошибка"
            # Логируем полную ошибку для отладки
            print(f"Backup error: {error_detail}")
            print(f"Command: {' '.join(cmd)}")
            print(f"Host: {host}, Port: {port}, User: {user}, DB: {dbname}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка pg_dump: {error_detail}"
            )

        log_action(
            db=db,
            user_id=str(current_user.id),
            action_type="create_backup",
            entity_type="backup",
            entity_id=filename,
            description=f"Создан бэкап БД: {filename}",
        )

        return BackupResponse(
            filename=filename,
            size=filepath.stat().st_size,
            created_at=datetime.now(timezone.utc),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected backup error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании бэкапа: {str(e)}"
        )


@router.get("/backups", response_model=list[BackupResponse])
async def get_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Получить список всех бэкапов.
    Доступно: admin.
    """
    backup_dir = Path(settings.BASE_DIR.parent) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    backups = []
    for file in backup_dir.glob("backup_*.sql"):
        stat = file.stat()
        backups.append(
            BackupResponse(
                filename=file.name,
                size=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime),
            )
        )

    return sorted(backups, key=lambda x: x.created_at, reverse=True)


@router.get("/backups/{filename}")
async def download_backup(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    """
    Скачать файл бэкапа.
    Доступно: admin.
    """
    from fastapi.responses import FileResponse

    backup_dir = Path(settings.BASE_DIR.parent) / "backups"
    filepath = backup_dir / filename

    if not filepath.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бэкап не найден"
        )

    # Проверяем что файл находится в директории бэкапов (защита от path traversal)
    try:
        filepath.resolve().relative_to(backup_dir.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректное имя файла"
        )

    return FileResponse(
        path=str(filepath),
        filename=filename,
        media_type="application/sql",
    )
