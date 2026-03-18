import re
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from ..models.logging import ActionLog

# Используем bcrypt напрямую вместо passlib
import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Хеширование пароля."""
    # Валидация пароля
    if len(password) < 8:
        raise ValueError("Пароль должен быть не менее 8 символов")
    if not any(ch.isalpha() for ch in password):
        raise ValueError("Пароль должен содержать хотя бы одну букву")
    if not any(ch.isdigit() for ch in password):
        raise ValueError("Пароль должен содержать хотя бы одну цифру")
    
    # Хеширование через bcrypt
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')


def log_action(
    db: Session,
    *,
    user_id: Optional[str],
    action_type: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    description: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """Запись действия пользователя в таблицу action_logs."""
    ip_address = None
    user_agent = None
    if request is not None:
        client = request.client
        ip_address = client.host if client else None
        user_agent = request.headers.get("user-agent")

    log = ActionLog(
        user_id=user_id,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    db.commit()

