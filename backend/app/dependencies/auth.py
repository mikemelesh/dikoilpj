import uuid
from datetime import datetime, timedelta
from typing import Annotated, Callable, Dict, Iterable, Optional, Set

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.user import User, UserRole


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

_blacklisted_jti: Set[str] = set()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Создание access-токена."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or settings.access_token_expires)
    jti = to_encode.get("jti") or str(uuid.uuid4())
    to_encode.update({"exp": expire, "type": "access", "jti": jti})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Создание refresh-токена."""
    to_encode = data.copy()
    expire = datetime.utcnow() + settings.refresh_token_expires
    jti = to_encode.get("jti") or str(uuid.uuid4())
    to_encode.update({"exp": expire, "type": "refresh", "jti": jti})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Dict:
    """Проверка токена и возврат payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен",
        )
    jti = payload.get("jti")
    if jti and jti in _blacklisted_jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен отозван",
        )
    return payload


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    """Получение текущего пользователя по access-токену."""
    payload = verify_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный тип токена",
        )
    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не удалось определить пользователя",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Проверка, что пользователь активен."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован",
        )
    return current_user


def require_roles(allowed_roles: Iterable[str]) -> Callable:
    """Фабрика зависимости для проверки ролей."""
    allowed_set = set(allowed_roles)

    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав",
            )
        return current_user

    return dependency


def blacklist_token(token: str) -> None:
    """Добавить токен в blacklist по jti."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        jti = payload.get("jti")
        if jti:
            _blacklisted_jti.add(jti)
    except JWTError:
        # Если токен невалидный, просто игнорируем
        return


def login_rate_limit():
    return limiter.limit("5/minute")


def register_rate_limit():
    return limiter.limit("3/minute")


def default_rate_limit():
    return limiter.limit("100/minute")
