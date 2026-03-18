"""
Скрипт для очистки базы данных от всех записей.
Запуск: python -m app.clear_db (из директории backend/)
"""
from pathlib import Path
from dotenv import load_dotenv

# Загружаем .env файл
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy import text
from .database import SessionLocal, engine


def clear_database():
    """Удаление всех записей из базы данных."""
    print("🗑️  Очистка базы данных...")
    
    db = SessionLocal()
    try:
        # Получаем список всех таблиц в правильном порядке (сначала дочерние)
        tables_order = [
            "order_status_history",
            "order_items",
            "material_requests",
            "reviews",
            "articles",
            "promotion_applies_to",
            "promotions",
            "knowledge_base",
            "client_profiles",
            "technician_profiles",
            "services",
            "service_categories",
            "orders",
            "materials",
            "user_logging",
            "users",
        ]
        
        for table in tables_order:
            try:
                db.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
                print(f"  ✅ Удалена таблица {table}")
            except Exception as e:
                print(f"  ⚠️  Таблица {table}: {str(e)}")
        
        db.commit()
        
        # Пересоздаем все таблицы
        from .database import Base
        Base.metadata.create_all(bind=engine)
        print("\n✅ Таблицы пересозданы!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Ошибка при очистке: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clear_database()
