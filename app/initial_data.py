from sqlalchemy import text

from app.core.security import get_password_hash
from app.db.session import SessionLocal, engine
from app.models import Service, User, UserRole


def init_db() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE orders ADD COLUMN rejection_message TEXT"))
            conn.commit()
    except Exception:
        pass

    db = SessionLocal()

    admin = db.query(User).filter(User.email == "admin@dentallab.by").first()
    if not admin:
        admin = User(
            email="admin@dentallab.by",
            hashed_password=get_password_hash("admin123"),
            full_name="Администратор",
            phone="+375291234567",
            role=UserRole.ADMIN,
        )
        db.add(admin)

    if db.query(Service).count() == 0:
        services = [
            Service(
                name="Металлокерамическая коронка",
                description="Прочная коронка на основе металлического каркаса с керамическим покрытием",
                base_price=150.0,
                material="Металлокерамика",
                production_time_days=7,
                category="Коронки",
            ),
            Service(
                name="Циркониевая коронка",
                description="Эстетичная и прочная коронка из диоксида циркония",
                base_price=300.0,
                material="Диоксид циркония",
                production_time_days=10,
                category="Коронки",
            ),
            Service(
                name="Съемный протез полный",
                description="Полный съемный протез на верхнюю или нижнюю челюсть",
                base_price=500.0,
                material="Акриловая пластмасса",
                production_time_days=14,
                category="Протезы",
            ),
            Service(
                name="Бюгельный протез",
                description="Частичный съемный протез с металлическим каркасом",
                base_price=700.0,
                material="Металл + акрил",
                production_time_days=14,
                category="Протезы",
            ),
            Service(
                name="Керамический винир",
                description="Тонкая керамическая накладка для эстетической реставрации",
                base_price=250.0,
                material="Керамика E-max",
                production_time_days=7,
                category="Виниры",
            ),
            Service(
                name="Вкладка культевая",
                description="Литая культевая вкладка под коронку",
                base_price=80.0,
                material="Кобальт-хром",
                production_time_days=5,
                category="Вкладки",
            ),
            Service(
                name="Временная коронка",
                description="Временная пластмассовая коронка",
                base_price=30.0,
                material="Пластмасса",
                production_time_days=2,
                category="Коронки",
            ),
        ]
        db.add_all(services)

    db.commit()
    db.close()

