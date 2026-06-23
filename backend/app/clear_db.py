"""
Скрипт для полной очистки базы данных.
Запуск: python3 -m app.clear_db (из директории backend/)
"""
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import inspect, text

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from .database import SessionLocal, engine, Base

TRUNCATE_TABLE_NAMES = (
    "notifications",
    "action_logs",
    "order_status_history",
    "order_items",
    "order_files",
    "material_requests",
    "reviews",
    "order_templates",
    "orders",
    "clients",
    "technicians",
    "materials",
    "services",
    "service_categories",
    "articles",
    "knowledge_base",
    "faqs",
    "promotions",
    "users",
)


def flush_all_data(db=None):
    """Удаляет все данные, сохраняя схему таблиц."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    try:
        existing = set(inspect(engine).get_table_names())
        tables = [name for name in TRUNCATE_TABLE_NAMES if name in existing]
        if not tables:
            print("⚠️  Нет таблиц для очистки")
            return
        sql = f"TRUNCATE TABLE {', '.join(tables)} RESTART IDENTITY CASCADE"
        db.execute(text(sql))
        db.commit()
        print("✅ Все данные удалены")
    except Exception:
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


def clear_database():
    """Полный сброс: удаление и пересоздание таблиц."""
    print("🗑️  Полный сброс базы данных...")
    db = SessionLocal()
    try:
        db.execute(text("DROP SCHEMA public CASCADE"))
        db.execute(text("CREATE SCHEMA public"))
        db.commit()
        Base.metadata.create_all(bind=engine)
        print("✅ Таблицы пересозданы")
    except Exception as e:
        db.rollback()
        print(f"\n❌ Ошибка при очистке: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    flush_all_data()
