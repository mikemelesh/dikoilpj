from datetime import datetime, timedelta
from typing import List, Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from jose.exceptions import JWTError
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import User, UserRole


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.strip()
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (UnknownHashError, Exception):
        try:
            if isinstance(hashed_password, str):
                hashed_password_bytes = hashed_password.encode("utf-8")
            else:
                hashed_password_bytes = hashed_password
            if isinstance(plain_password, str):
                plain_password_bytes = plain_password.encode("utf-8")
            else:
                plain_password_bytes = plain_password
            return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)
        except Exception:
            return False


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + settings.ACCESS_TOKEN_EXPIRE_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_roles(allowed_roles: List[UserRole]):
    """
    Dependency factory that returns a dependency function to check user roles.
    Usage: Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
    """
    async def role_checker(
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

