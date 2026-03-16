from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import util as slowapi_util
from sqlalchemy.orm import Session

from ..config import settings
from ..dependencies import get_db
from ..dependencies.auth import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    get_current_active_user,
    limiter,
    verify_token,
)
from ..models import Client, User, UserRole
from ..utils.security import get_password_hash, log_action, verify_password

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8 or not any(ch.isalpha() for ch in v) or not any(ch.isdigit() for ch in v):
            raise ValueError("Пароль должен быть не менее 8 символов и содержать букву и цифру")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserInfo(BaseModel):
    id: str
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    role: str

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserInfo
    client_profile: Optional[dict] = None
    technician_profile: Optional[dict] = None


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
)
@limiter.limit("3/minute")
async def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email уже зарегистрирован")

    hashed_password = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed_password,
        role=UserRole.CLIENT,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    )
    db.add(user)
    db.flush()

    client = Client(
        user_id=user.id,
    )
    db.add(client)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    log_action(
        db,
        user_id=str(user.id),
        action_type="register",
        entity_type="user",
        entity_id=str(user.id),
        description="Регистрация пользователя",
        request=request,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/login",
    response_model=TokenResponse,
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная пара логин/пароль")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    log_action(
        db,
        user_id=str(user.id),
        action_type="login",
        entity_type="user",
        entity_id=str(user.id),
        description="Вход пользователя",
        request=request,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("5/minute")
async def refresh_token(
    request: Request,
    payload: RefreshRequest,
    db: Session = Depends(get_db),
):
    raw_refresh = payload.refresh_token
    if not raw_refresh:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Требуется refresh_token")

    decoded = verify_token(raw_refresh)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный тип токена")

    user_id = decoded.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь недоступен")

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    log_action(
        db,
        user_id=str(user.id),
        action_type="refresh",
        entity_type="user",
        entity_id=str(user.id),
        description="Обновление токена",
        request=request,
    )

    return TokenResponse(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout")
@limiter.limit("5/minute")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    decoded = verify_token(token)
    user_id = decoded.get("sub")
    blacklist_token(token)

    log_action(
        db,
        user_id=str(user_id),
        action_type="logout",
        entity_type="user",
        entity_id=str(user_id),
        description="Выход пользователя",
        request=request,
    )

    return {"detail": "Выход выполнен"}


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    client_profile = None
    technician_profile = None

    if current_user.role == UserRole.CLIENT:
        client = db.query(Client).filter(Client.user_id == current_user.id).first()
        if client:
            client_profile = {
                "clinic_name": client.clinic_name,
                "address": client.address,
                "discount_percent": client.discount_percent,
                "loyalty_tier": client.loyalty_tier,
                "total_orders": client.total_orders,
            }

    # Заглушка для профиля техника, можно дополнить позже

    return MeResponse(
        user=UserInfo.model_construct(
            id=str(current_user.id),
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            phone=current_user.phone,
            role=current_user.role,
        ),
        client_profile=client_profile,
        technician_profile=technician_profile,
    )

