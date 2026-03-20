from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..dependencies.auth import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    get_current_active_user,
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
    role: Optional[str] = "client"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8 or not any(ch.isalpha() for ch in v) or not any(ch.isdigit() for ch in v):
            raise ValueError("Пароль должен быть не менее 8 символов и содержать букву и цифру")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed_roles = ["client", "manager", "technician"]
        if v not in allowed_roles:
            raise ValueError(f"Роль должна быть одной из: {', '.join(allowed_roles)}")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserInfo(BaseModel):
    id: str
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserInfo
    client_profile: Optional[dict] = None
    technician_profile: Optional[dict] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    user: UserInfo
    client_profile: Optional[dict] = None
    technician_profile: Optional[dict] = None


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
)
async def register(
    payload: RegisterRequest,
    request: Request,
):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email уже зарегистрирован")

        hashed_password = get_password_hash(payload.password)
        user_role = UserRole(payload.role) if payload.role else UserRole.CLIENT
        
        user = User(
            email=payload.email,
            hashed_password=hashed_password,
            role=user_role,
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=payload.phone,
        )
        db.add(user)
        db.flush()

        # Создаем профиль в зависимости от роли
        if user_role == UserRole.CLIENT:
            client = Client(user_id=user.id)
            db.add(client)
        elif user_role == UserRole.TECHNICIAN:
            from ..models.technician import Technician
            technician = Technician(user_id=user.id)
            db.add(technician)
        # Для manager профиль не требуется
        
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

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserInfo(
                id=str(user.id),
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                role=user.role.value,
            )
        )
    finally:
        db.close()


@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == form_data.username).first()
        if user is None or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверная пара логин/пароль")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")

        access_token = create_access_token({"sub": str(user.id)})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        # Получаем профиль клиента или техника
        client_profile = None
        technician_profile = None

        if user.role == UserRole.CLIENT:
            client = db.query(Client).filter(Client.user_id == user.id).first()
            if client:
                client_profile = {
                    "id": client.id,
                    "clinic_name": client.clinic_name,
                    "address": client.address,
                    "discount_percent": client.discount_percent,
                    "loyalty_tier": client.loyalty_tier,
                    "total_orders": client.total_orders,
                }
        elif user.role == UserRole.TECHNICIAN:
            from ..models.technician import Technician
            technician = db.query(Technician).filter(Technician.user_id == user.id).first()
            if technician:
                technician_profile = {
                    "id": technician.id,
                    "specialization": technician.specialization,
                    "experience_years": technician.experience_years,
                    "rating": technician.rating,
                    "completed_orders": technician.completed_orders,
                }

        log_action(
            db,
            user_id=str(user.id),
            action_type="login",
            entity_type="user",
            entity_id=str(user.id),
            description="Вход пользователя",
            request=request,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserInfo(
                id=str(user.id),
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone=user.phone,
                role=user.role.value,
            ),
            client_profile=client_profile,
            technician_profile=technician_profile,
        )
    finally:
        db.close()


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    payload: RefreshRequest,
):
    db = SessionLocal()
    try:
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
    finally:
        db.close()


@router.post("/logout")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
):
    db = SessionLocal()
    try:
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
    finally:
        db.close()


@router.get("/me", response_model=MeResponse)
async def get_me(
    current_user: User = Depends(get_current_active_user),
):
    db = SessionLocal()
    try:
        client_profile = None
        technician_profile = None

        if current_user.role == UserRole.CLIENT:
            client = db.query(Client).filter(Client.user_id == current_user.id).first()
            if client:
                client_profile = {
                    "id": client.id,
                    "clinic_name": client.clinic_name,
                    "address": client.address,
                    "discount_percent": client.discount_percent,
                    "loyalty_tier": client.loyalty_tier,
                    "total_orders": client.total_orders,
                }

        # Для техника
        if current_user.role == UserRole.TECHNICIAN:
            from ..models.technician import Technician
            technician = db.query(Technician).filter(Technician.user_id == current_user.id).first()
            if technician:
                technician_profile = {
                    "id": technician.id,
                    "specialization": technician.specialization,
                    "experience_years": technician.experience_years,
                    "rating": technician.rating,
                    "completed_orders": technician.completed_orders,
                }

        return MeResponse(
            user=UserInfo(
                id=str(current_user.id),
                email=current_user.email,
                first_name=current_user.first_name,
                last_name=current_user.last_name,
                phone=current_user.phone,
                role=current_user.role.value,
            ),
            client_profile=client_profile,
            technician_profile=technician_profile,
        )
    finally:
        db.close()

