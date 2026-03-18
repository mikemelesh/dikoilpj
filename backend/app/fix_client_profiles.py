"""
Скрипт для проверки и создания профилей клиентов.
Запуск: python -m app.fix_client_profiles
"""
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.client import Client


def fix_client_profiles():
    db = SessionLocal()
    
    # Находим всех пользователей с ролью CLIENT
    clients = db.query(User).filter(User.role == UserRole.CLIENT).all()
    
    print(f"Found {len(clients)} client users")
    
    for user in clients:
        # Проверяем, есть ли профиль
        profile = db.query(Client).filter(Client.user_id == user.id).first()
        if not profile:
            # Создаём профиль
            profile = Client(
                user_id=user.id,
                clinic_name=f"Клиника {user.first_name or user.email}",
                discount_percent=0.0,
                loyalty_tier="bronze",
                total_orders=0,
            )
            db.add(profile)
            print(f"Created profile for {user.email}")
        else:
            print(f"Profile exists for {user.email}")
    
    db.commit()
    db.close()
    print("Done!")


if __name__ == "__main__":
    fix_client_profiles()
