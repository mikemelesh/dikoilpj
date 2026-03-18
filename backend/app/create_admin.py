"""
Скрипт для создания администратора по умолчанию.
Запуск: python -m app.create_admin (из директории backend/)
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Загружаем .env файл
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models.user import User, UserRole
from .utils.security import get_password_hash


def create_admin_user(
    email: str = "admin@dental-lab.ru",
    password: str = "Admin123!",
    first_name: str = "Админ",
    last_name: str = "Главный",
    phone: str = "+7 (999) 000-00-00",
):
    """Создание пользователя с ролью администратора."""
    
    # Создаем таблицы если их нет
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Проверяем существует ли уже админ
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if existing_admin:
            print(f"⚠️  Администратор уже существует: {existing_admin.email}")
            return existing_admin
        
        # Проверяем существует ли пользователь с таким email
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"⚠️  Пользователь с email {email} уже существует")
            return existing_user
        
        # Создаем админа
        hashed_password = get_password_hash(password)
        admin = User(
            email=email,
            hashed_password=hashed_password,
            role=UserRole.ADMIN,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            is_active=True,
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print(f"✅ Администратор успешно создан:")
        print(f"   Email: {email}")
        print(f"   Пароль: {password}")
        print(f"   Роль: {UserRole.ADMIN.value}")
        
        return admin
        
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка при создании администратора: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_admin_user()
