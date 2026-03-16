import re
from typing import Optional

from fastapi import Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..models.logging import ActionLog


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PASSWORD_REGEX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    if not PASSWORD_REGEX.match(password):
        raise ValueError("Пароль должен быть не менее 8 символов и содержать буквы и цифры")
    return pwd_context.hash(password)


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

