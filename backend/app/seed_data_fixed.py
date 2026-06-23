"""
Скрипт для заполнения базы данных тестовыми данными с ПРАВИЛЬНЫМ распределением.
Каждый клиент имеет свои заказы, каждый техник - свои.
Запуск: python -m app.seed_data_fixed (из директории backend/)
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from dotenv import load_dotenv
import uuid
import sys
import os

# Чтобы вывод с emoji не падал из-за кодировки консоли Windows (cp1251)
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models.user import User, UserRole, LoyaltyTier
from .models.client import Client
from .models.technician import Technician
from .models.service import Service, ServiceCategory
from .models.order import Order, OrderItem, OrderStatus, OrderPriority, OrderStatusHistory, OrderFile
from .models.material import Material
from .models.order import MaterialRequest, MaterialRequestStatus
from .models.review import Review
from .models.article import Article
from .models.promotion import Promotion, PromotionAppliesTo
from .models.knowledge import KnowledgeBase
from .models.faq import Faq
from .models.notification import Notification
from .models.order_template import OrderTemplate
from .utils.security import get_password_hash
from .clear_db import flush_all_data
from .seed_content import ARTICLES_DATA, KNOWLEDGE_BASE_DATA, USERS_DATA


def create_users(db: Session) -> dict:
    """Создание тестовых пользователей."""
    print("📝 Создание пользователей...")

    users_data = USERS_DATA

    users = {}
    for user_data in users_data:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if existing:
            users[user_data["email"]] = existing
            continue

        user = User(
            email=user_data["email"],
            hashed_password=get_password_hash(user_data["password"]),
            role=user_data["role"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            phone=user_data["phone"],
            is_active=True,
        )
        db.add(user)
        db.flush()
        users[user_data["email"]] = user
        print(f"  ✅ {user_data['role'].value}: {user_data['email']}")

    db.commit()
    return users


def create_clients(db: Session, users: dict) -> dict:
    """Создание профилей клиентов."""
    print("\n🏥 Создание клиентов...")

    # Сначала очищаем все связанные таблицы, потом клиентов и техников
    print("  🗑️  Очистка старых данных...")
    db.query(OrderStatusHistory).delete()
    db.query(OrderItem).delete()
    db.query(Review).delete()
    db.query(MaterialRequest).delete()
    db.query(OrderFile).delete()
    db.query(Order).delete()
    db.query(Client).delete()
    db.query(Technician).delete()
    db.commit()

    clients_data = [
        {"user_email": "client1@dental-lab.ru", "clinic_name": "Стоматология 'Улыбка'", "address": "г. Москва, ул. Ленина, 10", "discount_percent": 5.0, "loyalty_tier": LoyaltyTier.BRONZE, "total_orders": 3},
        {"user_email": "client2@dental-lab.ru", "clinic_name": "Клиника 'Дентал-Про'", "address": "г. Москва, ул. Пушкина, 25", "discount_percent": 10.0, "loyalty_tier": LoyaltyTier.SILVER, "total_orders": 8},
        {"user_email": "client3@dental-lab.ru", "clinic_name": "Зубной центр 'Элита'", "address": "г. Москва, ул. Чехова, 15", "discount_percent": 15.0, "loyalty_tier": LoyaltyTier.GOLD, "total_orders": 15},
        {"user_email": "client4@dental-lab.ru", "clinic_name": "Стоматология 'Вита'", "address": "г. Москва, ул. Гагарина, 8", "discount_percent": 20.0, "loyalty_tier": LoyaltyTier.PLATINUM, "total_orders": 25},
    ]

    clients = {}
    for client_data in clients_data:
        user = users.get(client_data["user_email"])
        if not user:
            continue

        # Удаляем всех существующих клиентов для этого пользователя (защита от дубликатов)
        db.query(Client).filter(Client.user_id == user.id).delete()

        client = Client(
            user_id=user.id,
            clinic_name=client_data["clinic_name"],
            address=client_data["address"],
            discount_percent=client_data["discount_percent"],
            loyalty_tier=client_data["loyalty_tier"].value,
            total_orders=client_data["total_orders"],
        )
        db.add(client)
        db.flush()
        clients[user.id] = client
        print(f"  ✅ Клиент: {client.clinic_name} (user_id={user.id})")

    db.commit()
    return clients


def create_technicians(db: Session, users: dict) -> dict:
    """Создание профилей техников."""
    print("\n🔧 Создание техников...")

    # Техники уже очищены в create_clients, просто создаем новых
    technicians_data = [
        {"user_email": "technician1@dental-lab.ru", "specialization": "Керамические реставрации", "experience_years": 8, "rating": 4.8, "completed_orders": 156, "portfolio_description": "Специализируюсь на художественной керамике и винирах.", "is_available": True},
        {"user_email": "technician2@dental-lab.ru", "specialization": "Съемные протезы", "experience_years": 12, "rating": 4.6, "completed_orders": 230, "portfolio_description": "Опыт работы с различными материалами для съемного протезирования.", "is_available": True},
        {"user_email": "technician3@dental-lab.ru", "specialization": "Металлокерамика", "experience_years": 5, "rating": 4.9, "completed_orders": 89, "portfolio_description": "Современные технологии CAD/CAM.", "is_available": False},
    ]

    technicians = {}
    for tech_data in technicians_data:
        user = users.get(tech_data["user_email"])
        if not user:
            continue

        # Удаляем всех существующих техников для этого пользователя
        db.query(Technician).filter(Technician.user_id == user.id).delete()

        technician = Technician(
            user_id=user.id,
            specialization=tech_data["specialization"],
            experience_years=tech_data["experience_years"],
            rating=tech_data["rating"],
            completed_orders=tech_data["completed_orders"],
            portfolio_description=tech_data["portfolio_description"],
            is_available=tech_data["is_available"],
        )
        db.add(technician)
        db.flush()
        technicians[user.id] = technician
        print(f"  ✅ Техник: {user.first_name} {user.last_name} - {tech_data['specialization']} (user_id={user.id})")

    db.commit()
    return technicians


def create_services(db: Session) -> dict:
    """Создание категорий и услуг."""
    print("\n💼 Создание услуг...")

    from .utils.service_categories import ensure_predefined_categories

    ensured = ensure_predefined_categories(db)
    categories = {c.name: c for c in ensured}
    for category in ensured:
        print(f"  ✅ Категория: {category.name}")

    services_data = [
        {"name": "Коронка металлокерамическая", "category": "Несъемные протезы", "base_price": 525, "unit": "шт", "duration_days": 7},
        {"name": "Коронка циркониевая", "category": "Несъемные протезы", "base_price": 875, "unit": "шт", "duration_days": 10},
        {"name": "Коронка E-max", "category": "Несъемные протезы", "base_price": 980, "unit": "шт", "duration_days": 7},
        {"name": "Винир керамический", "category": "Несъемные протезы", "base_price": 1050, "unit": "шт", "duration_days": 14},
        {"name": "Мостовидный протез (3 ед)", "category": "Несъемные протезы", "base_price": 1575, "unit": "работа", "duration_days": 14},
        {"name": "Частичный съемный протез", "category": "Съемные протезы", "base_price": 700, "unit": "шт", "duration_days": 10},
        {"name": "Полный съемный протез", "category": "Съемные протезы", "base_price": 1225, "unit": "челюсть", "duration_days": 14},
        {"name": "Бюгельный протез", "category": "Съемные протезы", "base_price": 1400, "unit": "шт", "duration_days": 14},
        {"name": "Протез на аттачменах", "category": "Съемные протезы", "base_price": 1925, "unit": "шт", "duration_days": 21},
        {"name": "Абатмент стандартный", "category": "Имплантация", "base_price": 420, "unit": "шт", "duration_days": 7},
        {"name": "Абатмент индивидуальный", "category": "Имплантация", "base_price": 700, "unit": "шт", "duration_days": 14},
        {"name": "Коронка на имплант", "category": "Имплантация", "base_price": 1225, "unit": "шт", "duration_days": 14},
        {"name": "Временная коронка на имплант", "category": "Имплантация", "base_price": 280, "unit": "шт", "duration_days": 3},
        {"name": "Ретенционная пластинка", "category": "Ортодонтия", "base_price": 350, "unit": "шт", "duration_days": 7},
        {"name": "Каппа ретенционная", "category": "Ортодонтия", "base_price": 175, "unit": "челюсть", "duration_days": 3},
        {"name": "Элайнеры (комплект)", "category": "Ортодонтия", "base_price": 5250, "unit": "комплект", "duration_days": 30},
        {"name": "Ремонт протеза", "category": "Дополнительные услуги", "base_price": 175, "unit": "работа", "duration_days": 3},
        {"name": "Перебазировка протеза", "category": "Дополнительные услуги", "base_price": 245, "unit": "работа", "duration_days": 5},
        {"name": "Изготовление воскового шаблона", "category": "Дополнительные услуги", "base_price": 105, "unit": "шт", "duration_days": 2},
    ]

    services = {}
    for svc_data in services_data:
        category = categories.get(svc_data["category"])
        if not category:
            continue

        existing = db.query(Service).filter(Service.name == svc_data["name"], Service.category_id == category.id).first()
        if existing:
            services[svc_data["name"]] = existing
            continue

        service = Service(
            category_id=category.id,
            name=svc_data["name"],
            description=f"Качественное изготовление {svc_data['name'].lower()}",
            base_price=svc_data["base_price"],
            unit=svc_data["unit"],
            duration_days=svc_data["duration_days"],
            is_active=True,
        )
        db.add(service)
        db.flush()
        services[service.name] = service

    db.commit()
    print(f"  ✅ Создано {len(services)} услуг")
    return {"categories": categories, "services": services}


def create_orders(db: Session, clients: dict, technicians: dict, services: dict, users: dict) -> list:
    """
    Создание заказов с ПРАВИЛЬНЫМ распределением:
    - У каждого клиента свои заказы
    - У каждого техника свои назначенные заказы
    """
    print("\n📦 Создание заказов (индивидуальное распределение)...")

    # Получаем списки
    client_users = [users["client1@dental-lab.ru"], users["client2@dental-lab.ru"], users["client3@dental-lab.ru"], users["client4@dental-lab.ru"]]
    technician_users = [users["technician1@dental-lab.ru"], users["technician2@dental-lab.ru"], users["technician3@dental-lab.ru"]]
    manager_users = [users["manager1@dental-lab.ru"], users["manager2@dental-lab.ru"]]

    services_dict = services.get("services", {})

    # Конфигурация заказов для каждого клиента (БОЛЬШЕ ТЕСТОВЫХ ДАННЫХ)
    # client_index -> список заказов с техниками
    orders_config = {
        0: [  # client1 - 5 заказов
            {"technician_idx": 0, "status": OrderStatus.IN_PROGRESS, "priority": OrderPriority.NORMAL, "services": ["Коронка циркониевая", "Коронка E-max"], "notes": "Сделать в приоритетном порядке", "deadline_days": 7},
            {"technician_idx": None, "status": OrderStatus.NEW, "priority": OrderPriority.CRITICAL, "services": ["Абатмент индивидуальный", "Коронка на имплант"], "notes": "Срочный заказ!", "deadline_days": 5},
            {"technician_idx": 2, "status": OrderStatus.ARCHIVED, "priority": OrderPriority.NORMAL, "services": ["Ретенционная пластинка"], "notes": "Архивный заказ", "deadline_days": 0, "completed_days_ago": 60},
            {"technician_idx": 0, "status": OrderStatus.COMPLETED, "priority": OrderPriority.NORMAL, "services": ["Винир керамический"], "notes": "Выполнен качественно", "deadline_days": 10, "completed_days_ago": 15},
            {"technician_idx": 1, "status": OrderStatus.CONFIRMED, "priority": OrderPriority.URGENT, "services": ["Мостовидный протез (3 ед)"], "notes": "Важный заказ", "deadline_days": 12},
            {"technician_idx": 0, "status": OrderStatus.CANCELLED, "priority": OrderPriority.NORMAL, "services": ["Коронка металлокерамическая"], "notes": "Отменён клиентом", "deadline_days": 7},
        ],
        1: [  # client2 - 5 заказов
            {"technician_idx": 1, "status": OrderStatus.IN_PROGRESS, "priority": OrderPriority.URGENT, "services": ["Винир керамический"], "notes": "Важный клиент", "deadline_days": 10},
            {"technician_idx": 2, "status": OrderStatus.REVIEW, "priority": OrderPriority.NORMAL, "services": ["Бюгельный протез"], "notes": "Готов к проверке", "deadline_days": 0},
            {"technician_idx": 0, "status": OrderStatus.COMPLETED, "priority": OrderPriority.NORMAL, "services": ["Коронка металлокерамическая"], "notes": "Успешно выполнен", "deadline_days": 7, "completed_days_ago": 10},
            {"technician_idx": 1, "status": OrderStatus.NEW, "priority": OrderPriority.NORMAL, "services": ["Полный съемный протез"], "notes": "Новый заказ", "deadline_days": 14},
            {"technician_idx": None, "status": OrderStatus.CONFIRMED, "priority": OrderPriority.NORMAL, "services": ["Абатмент стандартный"], "notes": "Ожидает назначения техника", "deadline_days": 7},
            {"technician_idx": 2, "status": OrderStatus.CANCELLED, "priority": OrderPriority.URGENT, "services": ["Каппа ретенционная"], "notes": "Отменён из-за изменения плана лечения", "deadline_days": 5},
        ],
        2: [  # client3 - 6 заказов
            {"technician_idx": 0, "status": OrderStatus.CONFIRMED, "priority": OrderPriority.NORMAL, "services": ["Мостовидный протез (3 ед)", "Коронка металлокерамическая"], "notes": "Комплексный заказ", "deadline_days": 14},
            {"technician_idx": 1, "status": OrderStatus.COMPLETED, "priority": OrderPriority.NORMAL, "services": ["Частичный съемный протез", "Ремонт протеза"], "notes": "Заказ выполнен", "deadline_days": 7, "completed_days_ago": 5},
            {"technician_idx": 2, "status": OrderStatus.IN_PROGRESS, "priority": OrderPriority.CRITICAL, "services": ["Коронка на имплант"], "notes": "Срочный заказ", "deadline_days": 3},
            {"technician_idx": 0, "status": OrderStatus.ARCHIVED, "priority": OrderPriority.NORMAL, "services": ["Каппа ретенционная"], "notes": "Архив", "deadline_days": 0, "completed_days_ago": 90},
            {"technician_idx": 1, "status": OrderStatus.NEW, "priority": OrderPriority.NORMAL, "services": ["Протез на аттачменах"], "notes": "Сложный заказ", "deadline_days": 21},
            {"technician_idx": 2, "status": OrderStatus.COMPLETED, "priority": OrderPriority.URGENT, "services": ["Временная коронка на имплант"], "notes": "Быстро выполнили", "deadline_days": 2, "completed_days_ago": 3},
        ],
        3: [  # client4 - 6 заказов
            {"technician_idx": None, "status": OrderStatus.NEW, "priority": OrderPriority.NORMAL, "services": ["Полный съемный протез"], "notes": "Первый заказ клиента", "deadline_days": 14},
            {"technician_idx": 0, "status": OrderStatus.COMPLETED, "priority": OrderPriority.URGENT, "services": ["Коронка металлокерамическая"], "notes": "Срочный заказ выполнен", "deadline_days": 3, "completed_days_ago": 2},
            {"technician_idx": 1, "status": OrderStatus.IN_PROGRESS, "priority": OrderPriority.NORMAL, "services": ["Элайнеры (комплект)"], "notes": "Длительный заказ", "deadline_days": 30},
            {"technician_idx": 2, "status": OrderStatus.CONFIRMED, "priority": OrderPriority.NORMAL, "services": ["Изготовление воскового шаблона"], "notes": "Подготовка", "deadline_days": 2},
            {"technician_idx": 0, "status": OrderStatus.REVIEW, "priority": OrderPriority.NORMAL, "services": ["Перебазировка протеза"], "notes": "На проверке", "deadline_days": 0},
            {"technician_idx": 1, "status": OrderStatus.ARCHIVED, "priority": OrderPriority.NORMAL, "services": ["Ремонт протеза"], "notes": "Старый заказ", "deadline_days": 0, "completed_days_ago": 45},
        ],
    }

    orders = []
    base_time = datetime.now(timezone.utc)
    order_counter = 0

    for client_idx, client_orders in orders_config.items():
        client_user = client_users[client_idx]
        client = clients.get(client_user.id)
        if not client:
            print(f"  ⚠️  Клиент для {client_user.email} не найден!")
            continue

        for order_idx, order_config in enumerate(client_orders):
            technician = None
            if order_config.get("technician_idx") is not None:
                tech_user = technician_users[order_config["technician_idx"]]
                technician = technicians.get(tech_user.id)

            manager = manager_users[client_idx % len(manager_users)]

            # Уникальное время для каждого заказа
            if "completed_days_ago" in order_config:
                order_created_at = base_time - timedelta(days=order_config["completed_days_ago"], hours=order_counter)
            else:
                order_created_at = base_time - timedelta(minutes=order_counter * 10)
            order_counter += 1

            # Генерация номера заказа (counter + 8 hex — избегаем коллизий 4-символьного суффикса)
            order_number = (
                f"ORD-{order_created_at.strftime('%Y%m%d')}-"
                f"{order_counter:04d}-{uuid.uuid4().hex[:8].upper()}"
            )

            # Расчет даты дедлайна
            deadline = order_created_at + timedelta(days=order_config["deadline_days"]) if order_config["deadline_days"] > 0 else None

            # Расчет стоимости
            total_price = Decimal('0')
            order_items = []

            for svc_name in order_config["services"]:
                service = services_dict.get(svc_name)
                if service:
                    quantity = 1 if "3 ед" not in svc_name else 3
                    item_total = service.base_price * quantity
                    total_price += Decimal(str(item_total))
                    order_items.append({"service": service, "quantity": quantity, "unit_price": service.base_price, "total_price": item_total})

            discount_amount = total_price * Decimal(str(client.discount_percent)) / Decimal('100')
            final_price = total_price - discount_amount

            order = Order(
                order_number=order_number,
                client_id=client.id,
                technician_id=technician.id if technician else None,
                manager_id=manager.id if manager else None,
                status=order_config["status"],
                priority=order_config["priority"],
                total_price=float(total_price),
                discount_amount=float(discount_amount),
                final_price=float(final_price),
                notes=order_config.get("notes"),
                deadline=deadline,
                created_at=order_created_at,
            )

            if order_config["status"] == OrderStatus.COMPLETED and "completed_days_ago" in order_config:
                order.completed_at = order_created_at + timedelta(days=order_config["deadline_days"] or 7)

            db.add(order)
            db.flush()

            # Элементы заказа
            for item_data in order_items:
                order_item = OrderItem(
                    order_id=order.id,
                    service_id=item_data["service"].id,
                    quantity=item_data["quantity"],
                    unit_price=item_data["unit_price"],
                    total_price=item_data["total_price"],
                )
                db.add(order_item)

            # История статусов
            status_history = OrderStatusHistory(
                order_id=order.id,
                old_status=OrderStatus.NEW,
                new_status=OrderStatus.NEW,
                changed_by=manager.id if manager else None,
                comment="Заказ создан",
            )
            db.add(status_history)

            if order_config["status"] != OrderStatus.NEW:
                status_history = OrderStatusHistory(
                    order_id=order.id,
                    old_status=OrderStatus.NEW,
                    new_status=order_config["status"],
                    changed_by=manager.id if manager else None,
                    comment=f"Статус изменен на {order_config['status'].value}",
                )
                db.add(status_history)

            orders.append(order)
            tech_name = technician.user.first_name if technician else "Не назначен"
            print(f"  ✅ Заказ {order.order_number}: client={client.clinic_name[:20]}..., tech={tech_name}, status={order.status.value}, {final_price} BYN")

    db.commit()
    print(f"  ✅ Создано {len(orders)} заказов")
    return orders


def create_materials(db: Session) -> list:
    """Создание материалов."""
    print("\n🧪 Создание материалов...")

    materials_data = [
        {"name": "Диоксид циркония", "unit": "г", "quantity": 500, "min_quantity": 100, "price_per_unit": 5.25, "supplier": "Zirkonzahn"},
        {"name": "Керамическая масса", "unit": "г", "quantity": 200, "min_quantity": 50, "price_per_unit": 2.80, "supplier": "Ivoclar"},
        {"name": "Кобальт-хром сплав", "unit": "г", "quantity": 300, "min_quantity": 80, "price_per_unit": 4.20, "supplier": "Bego"},
        {"name": "Акриловая смола", "unit": "мл", "quantity": 1000, "min_quantity": 200, "price_per_unit": 0.88, "supplier": "Kulzer"},
        {"name": "Воск моделировочный", "unit": "г", "quantity": 150, "min_quantity": 30, "price_per_unit": 0.53, "supplier": "Kerr"},
        {"name": "Фоторезин для 3D печати", "unit": "мл", "quantity": 80, "min_quantity": 100, "price_per_unit": 1.58, "supplier": "Formlabs"},
        {"name": "Цемент фиксирующий", "unit": "мл", "quantity": 250, "min_quantity": 50, "price_per_unit": 1.23, "supplier": "3M"},
        {"name": "Силикон для форм", "unit": "мл", "quantity": 400, "min_quantity": 100, "price_per_unit": 1.93, "supplier": "Zhermack"},
    ]

    materials = []
    for mat_data in materials_data:
        existing = db.query(Material).filter(Material.name == mat_data["name"]).first()
        if existing:
            materials.append(existing)
            continue

        material = Material(
            name=mat_data["name"],
            description="Материал для зуботехнических работ",
            unit=mat_data["unit"],
            quantity=mat_data["quantity"],
            min_quantity=mat_data["min_quantity"],
            price_per_unit=mat_data["price_per_unit"],
            supplier=mat_data["supplier"],
        )
        db.add(material)
        db.flush()
        materials.append(material)
        stock_status = "⚠️ низкий остаток" if mat_data["quantity"] <= mat_data["min_quantity"] else "✅"
        print(f"  {stock_status} {material.name}: {material.quantity} {material.unit}")

    db.commit()
    return materials


def create_material_requests(db: Session, materials: list, technicians: dict, users: dict) -> list:
    """Создание запросов на материалы."""
    print("\n📝 Создание запросов на материалы...")

    tech_users = list(technicians.keys())

    requests_data = [
        {"material_idx": 0, "technician_idx": 0, "quantity": 50, "status": MaterialRequestStatus.PENDING, "comment": "Срочно нужно для заказа"},
        {"material_idx": 5, "technician_idx": 1, "quantity": 100, "status": MaterialRequestStatus.APPROVED, "comment": "Для 3D печати"},
        {"material_idx": 3, "technician_idx": 2, "quantity": 200, "status": MaterialRequestStatus.PENDING, "comment": None},
        {"material_idx": 1, "technician_idx": 0, "quantity": 30, "status": MaterialRequestStatus.REJECTED, "comment": "Превышен лимит"},
        {"material_idx": 2, "technician_idx": 2, "quantity": 75, "status": MaterialRequestStatus.ISSUED, "comment": "Выдано со склада"},
    ]

    requests = []
    for req_data in requests_data:
        if req_data["technician_idx"] >= len(tech_users):
            continue

        technician = technicians.get(tech_users[req_data["technician_idx"]])
        material = materials[req_data["material_idx"]]

        request = MaterialRequest(
            technician_id=technician.id,
            material_id=material.id,
            quantity_requested=req_data["quantity"],
            status=req_data["status"],
            comment=req_data.get("comment"),
        )

        if req_data["status"] != MaterialRequestStatus.PENDING:
            request.resolved_by = users.get("manager1@dental-lab.ru").id
            request.resolved_at = datetime.now(timezone.utc) - timedelta(days=2)

        db.add(request)
        db.flush()
        requests.append(request)
        print(f"  ✅ Запрос: {technician.user.first_name} - {material.name} ({req_data['status'].value})")

    db.commit()
    return requests


def create_reviews(db: Session, clients: dict, orders: list) -> list:
    """Создание отзывов."""
    print("\n⭐ Создание отзывов...")

    completed_orders = [o for o in orders if o.status == OrderStatus.COMPLETED]
    client_ids = list(clients.keys())

    reviews_data = [
        {"client_idx": 0, "order": completed_orders[0] if len(completed_orders) > 0 else None, "rating": 5, "text": "Отличное качество! Все сроки соблюдены. Буду заказывать ещё.", "is_moderated": True, "is_published": True},
        {"client_idx": 1, "order": completed_orders[1] if len(completed_orders) > 1 else None, "rating": 4, "text": "Хорошая работа, но немного задержали срок.", "is_moderated": True, "is_published": True},
        {"client_idx": 2, "order": completed_orders[2] if len(completed_orders) > 2 else None, "rating": 5, "text": "Превосходное качество керамики. Клиент доволен!", "is_moderated": True, "is_published": True},
        {"client_idx": 3, "order": completed_orders[3] if len(completed_orders) > 3 else None, "rating": 5, "text": "Профессиональный подход к работе. Рекомендую!", "is_moderated": True, "is_published": True},
        {"client_idx": 0, "order": completed_orders[4] if len(completed_orders) > 4 else None, "rating": 4, "text": "Качество на высоте, цвет коронки совпал идеально.", "is_moderated": True, "is_published": True},
        {"client_idx": 1, "order": completed_orders[5] if len(completed_orders) > 5 else None, "rating": 3, "text": "Пришлось доработать посадку, но в целом неплохо.", "is_moderated": True, "is_published": False},
        {"client_idx": 2, "order": None, "rating": 5, "text": "Лучшая лаборатория в городе, работаем уже третий год.", "is_moderated": False, "is_published": False},
        {"client_idx": 3, "order": completed_orders[6] if len(completed_orders) > 6 else None, "rating": 4, "text": "Быстро выполнили срочный заказ, спасибо менеджеру.", "is_moderated": True, "is_published": True},
        {"client_idx": 1, "order": None, "rating": 2, "text": "Долго ждали ответа по статусу заказа.", "is_moderated": False, "is_published": False},
        {"client_idx": 0, "order": completed_orders[7] if len(completed_orders) > 7 else None, "rating": 5, "text": "Виниры выглядят естественно, пациент в восторге.", "is_moderated": True, "is_published": True},
    ]

    reviews = []
    for rev_data in reviews_data:
        if rev_data["client_idx"] >= len(client_ids):
            continue

        client = clients[client_ids[rev_data["client_idx"]]]
        order = rev_data.get("order")

        review = Review(
            client_id=client.id,
            order_id=order.id if order else None,
            rating=rev_data["rating"],
            text=rev_data["text"],
            is_moderated=rev_data["is_moderated"],
            is_published=rev_data["is_published"],
        )
        db.add(review)
        db.flush()
        reviews.append(review)
        status = "опубликован" if rev_data["is_published"] else "на модерации"
        print(f"  ✅ Отзыв: {client.clinic_name} - {rev_data['rating']}⭐ ({status})")

    db.commit()
    return reviews


def create_articles(db: Session, users: dict) -> list:
    """Создание статей."""
    print("\nСоздание статей...")

    articles_data = ARTICLES_DATA

    articles = []
    admin_user = users.get("admin@dental-lab.ru")

    for article_data in articles_data:
        existing = db.query(Article).filter(Article.slug == article_data["slug"]).first()
        if existing:
            articles.append(existing)
            continue

        article = Article(
            title=article_data["title"],
            slug=article_data["slug"],
            content=article_data["content"],
            category=article_data["category"],
            author_id=admin_user.id if admin_user else None,
            is_published=article_data["is_published"],
        )
        db.add(article)
        db.flush()
        articles.append(article)
        print(f"  ✅ Статья: {article.title}")

    db.commit()
    return articles


def create_knowledge_base(db: Session, users: dict) -> list:
    """Создание базы знаний."""
    print("\nСоздание базы знаний...")

    kb_data = KNOWLEDGE_BASE_DATA

    knowledge = []
    admin_user = users.get("admin@dental-lab.ru")

    for kb_item in kb_data:
        existing = db.query(KnowledgeBase).filter(KnowledgeBase.title == kb_item["title"]).first()
        if existing:
            knowledge.append(existing)
            continue

        item = KnowledgeBase(
            title=kb_item["title"],
            content=kb_item["content"],
            category=kb_item["category"],
            tags=kb_item["tags"],
            created_by=admin_user.id if admin_user else None,
            is_published=True,
        )
        db.add(item)
        db.flush()
        knowledge.append(item)
        print(f"  ✅ БЗ: {item.title}")

    db.commit()
    return knowledge


def create_promotions(db: Session) -> list:
    """Создание акций."""
    print("\nСоздание акций...")

    from datetime import date, timedelta

    from .models.service import Service

    today = date.today()
    zirconia_service = db.query(Service).filter(Service.name == "Коронка циркониевая").first()

    promotions_data = [
        {
            "title": "Скидка 15% на циркониевые коронки",
            "description": "При заказе от 3-х единиц",
            "discount_percent": 15,
            "start_days": -5,
            "end_days": 25,
            "applies_to": "service",
            "target_id": zirconia_service.id if zirconia_service else None,
        },
        {"title": "Новогодняя акция", "description": "Скидка 20% на все услуги", "discount_percent": 20, "start_days": -30, "end_days": 10, "applies_to": "all", "target_id": None},
        {"title": "Бесплатная консультация техника", "description": "При первом заказе", "discount_percent": 0, "start_days": -1, "end_days": 60, "applies_to": "all", "target_id": None},
    ]

    promotions = []
    for promo_data in promotions_data:
        existing = db.query(Promotion).filter(Promotion.title == promo_data["title"]).first()
        if existing:
            if promo_data["target_id"] is not None and existing.target_id != promo_data["target_id"]:
                existing.target_id = promo_data["target_id"]
                db.add(existing)
            promotions.append(existing)
            continue

        promotion = Promotion(
            title=promo_data["title"],
            description=promo_data["description"],
            discount_percent=promo_data["discount_percent"],
            start_date=today + timedelta(days=promo_data["start_days"]),
            end_date=today + timedelta(days=promo_data["end_days"]),
            is_active=True,
            applies_to=PromotionAppliesTo(promo_data["applies_to"]),
            target_id=promo_data["target_id"],
        )
        db.add(promotion)
        db.flush()
        promotions.append(promotion)
        print(f"  ✅ Акция: {promotion.title} ({promotion.discount_percent}%)")

    db.commit()
    return promotions


def create_faqs(db: Session) -> list:
    """Создание FAQ."""
    print("\n❓ Создание FAQ...")

    faqs_data = [
        {"question": "Как сделать заказ?", "answer": "Для создания заказа зарегистрируйтесь на сайте, перейдите в личный кабинет клиента и нажмите «Создать заказ». Выберите необходимые услуги, укажите количество и заполните детали заказа.", "category": "Заказы", "sort_order": 1},
        {"question": "Какие сроки изготовления?", "answer": "Сроки изготовления зависят от типа услуги и сложности работы. Обычно от 3 до 21 дня. Точные сроки указываются при подтверждении заказа.", "category": "Заказы", "sort_order": 2},
        {"question": "Можно ли изменить заказ после оформления?", "answer": "Да, вы можете изменить заказ, пока он находится в статусе «Новый». После подтверждения заказа изменения возможны только через менеджера.", "category": "Заказы", "sort_order": 3},
        {"question": "Как отследить статус заказа?", "answer": "В личном кабинете клиента отображаются все ваши заказы с текущим статусом. Вы также получите уведомление при изменении статуса.", "category": "Заказы", "sort_order": 4},
        {"question": "Какие материалы вы используете?", "answer": "Мы используем только сертифицированные материалы от ведущих производителей: Zirkonzahn, Ivoclar, Bego, Kulzer, Kerr, Formlabs, 3M, Zhermack.", "category": "Материалы", "sort_order": 5},
        {"question": "Есть ли гарантия на работу?", "answer": "Да, на все работы предоставляется гарантия. Срок гарантии зависит от типа услуги и используемых материалов.", "category": "Гарантия", "sort_order": 6},
        {"question": "Как получить скидку?", "answer": "У нас действует программа лояльности. Скидка автоматически применяется к заказам в зависимости от накопленной суммы заказов: от 5% до 20%.", "category": "Оплата", "sort_order": 7},
        {"question": "Можно ли заказать срочное изготовление?", "answer": "Да, при оформлении заказа выберите приоритет «Срочный» или «Критичный». Обратите внимание, что за срочность может взиматься дополнительная плата.", "category": "Заказы", "sort_order": 8},
        {"question": "Как происходит оплата?", "answer": "Оплата производится после завершения заказа и перед выдачей. Возможна оплата наличными или безналичным расчётом.", "category": "Оплата", "sort_order": 9},
        {"question": "Можно ли вернуть заказ?", "answer": "Возврат возможен в случае брака или несоответствия specifications. Свяжитесь с менеджером в течение 3 дней после получения заказа.", "category": "Возврат", "sort_order": 10},
        {"question": "Как связаться с менеджером?", "answer": "Менеджер свяжется с вами после оформления заказа. Также вы можете написать через форму обратной связи или позвонить по телефону лаборатории.", "category": "Контакты", "sort_order": 11},
        {"question": "Работаете ли вы с цифровыми слепками?", "answer": "Да, мы принимаем файлы STL/OBJ от intraoral-сканеров. Укажите формат в комментарии к заказу.", "category": "Заказы", "sort_order": 12},
        {"question": "Можно ли повторить предыдущий заказ?", "answer": "В архиве заказов доступна кнопка «Повторить» — она создаст новый заказ на основе предыдущего.", "category": "Заказы", "sort_order": 13},
        {"question": "Какие документы вы предоставляете?", "answer": "По запросу выдаём акт выполненных работ и счёт. Документы доступны в личном кабинете после завершения заказа.", "category": "Оплата", "sort_order": 14},
        {"question": "Есть ли доставка готовых работ?", "answer": "Да, доставка по Москве и области. Стоимость и сроки согласуются с менеджером.", "category": "Доставка", "sort_order": 15},
    ]

    faqs = []
    for faq_data in faqs_data:
        existing = db.query(Faq).filter(Faq.question == faq_data["question"]).first()
        if existing:
            faqs.append(existing)
            continue

        faq = Faq(
            question=faq_data["question"],
            answer=faq_data["answer"],
            category=faq_data["category"],
            sort_order=faq_data["sort_order"],
            is_published=True,
        )
        db.add(faq)
        db.flush()
        faqs.append(faq)
        print(f"  ✅ FAQ: {faq.question[:50]}...")

    db.commit()
    return faqs


def create_notifications(db: Session, users: dict, orders: list) -> list:
    """Создание уведомлений."""
    print("\n🔔 Создание уведомлений...")

    manager = users.get("manager1@dental-lab.ru")
    client_user = users.get("client1@dental-lab.ru")
    tech_user = users.get("technician1@dental-lab.ru")

    notifications_data = [
        {"recipient": client_user, "sender": manager, "title": "Заказ подтверждён", "message": "Ваш заказ принят в работу. Менеджер свяжется с вами при необходимости.", "order": orders[0] if orders else None, "is_read": True},
        {"recipient": client_user, "sender": manager, "title": "Изменение статуса", "message": "Заказ переведён в статус «В работе».", "order": orders[0] if orders else None, "is_read": False},
        {"recipient": tech_user, "sender": manager, "title": "Новое назначение", "message": "Вам назначен новый заказ. Проверьте дедлайн и материалы.", "order": orders[0] if orders else None, "is_read": False},
        {"recipient": users.get("client2@dental-lab.ru"), "sender": manager, "title": "Заказ на проверке", "message": "Работа выполнена и ожидает проверки менеджером.", "order": orders[5] if len(orders) > 5 else None, "is_read": False},
        {"recipient": users.get("client3@dental-lab.ru"), "sender": manager, "title": "Заказ завершён", "message": "Заказ готов к выдаче. Свяжитесь с менеджером для получения.", "order": orders[10] if len(orders) > 10 else None, "is_read": True},
        {"recipient": users.get("manager2@dental-lab.ru"), "sender": None, "title": "Заявка на материалы", "message": "Техник подал заявку на диоксид циркония. Требуется согласование.", "order": None, "is_read": False},
        {"recipient": client_user, "sender": manager, "title": "Срок дедлайна", "message": "Напоминаем: до дедлайна по заказу осталось 2 дня.", "order": orders[1] if len(orders) > 1 else None, "is_read": False},
        {"recipient": users.get("client4@dental-lab.ru"), "sender": manager, "title": "Заказ отменён", "message": "Заказ отменён по запросу клиники.", "order": None, "is_read": True},
    ]

    notifications = []
    for item in notifications_data:
        if not item["recipient"]:
            continue
        notification = Notification(
            recipient_id=item["recipient"].id,
            sender_id=item["sender"].id if item["sender"] else None,
            title=item["title"],
            message=item["message"],
            notification_type="order_status",
            order_id=item["order"].id if item["order"] else None,
            is_read=item["is_read"],
        )
        db.add(notification)
        db.flush()
        notifications.append(notification)
        print(f"  ✅ Уведомление: {item['title']} → {item['recipient'].email}")

    db.commit()
    return notifications


def create_order_templates(db: Session, clients: dict, services: dict) -> list:
    """Создание шаблонов заказов."""
    print("\n📋 Создание шаблонов заказов...")

    services_dict = services.get("services", {})
    client_list = list(clients.values())
    if not client_list:
        return []

    templates_data = [
        {"client_idx": 0, "name": "Стандартная коронка", "items": ["Коронка металлокерамическая"], "notes": "Стандартный шаблон для одиночной коронки"},
        {"client_idx": 0, "name": "Имплант + коронка", "items": ["Абатмент индивидуальный", "Коронка на имплант"], "notes": "Комплект для имплантации"},
        {"client_idx": 1, "name": "Эстетика — виниры", "items": ["Винир керамический"], "notes": "Для фронтальной группы зубов"},
        {"client_idx": 2, "name": "Съёмный протез", "items": ["Полный съемный протез"], "notes": "Полный протез на одну челюсть"},
        {"client_idx": 3, "name": "Ортодонтия — элайнеры", "items": ["Элайнеры (комплект)"], "notes": "Полный комплект элайнеров"},
    ]

    templates = []
    for tpl in templates_data:
        if tpl["client_idx"] >= len(client_list):
            continue
        client = client_list[tpl["client_idx"]]
        items = []
        for svc_name in tpl["items"]:
            service = services_dict.get(svc_name)
            if service:
                items.append({"service_id": service.id, "service_name": service.name, "quantity": 1})

        template = OrderTemplate(
            client_id=client.id,
            name=tpl["name"],
            items=items,
            notes=tpl["notes"],
        )
        db.add(template)
        db.flush()
        templates.append(template)
        print(f"  ✅ Шаблон: {tpl['name']} ({client.clinic_name})")

    db.commit()
    return templates


def run_seed():
    """Запуск заполнения БД."""
    force = os.getenv("FORCE_SEED", "").lower() in ("1", "true", "yes")

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@dental-lab.ru").first()
        if admin and not force:
            print("ℹ️  Seed пропущен: в базе уже есть данные (FORCE_SEED=1 — пересоздать)")
            return
    finally:
        db.close()

    print("=" * 60)
    print("Запуск заполнения базы данных (индивидуальное распределение)...")
    print("=" * 60)

    db = SessionLocal()
    client_users = []
    technician_users = []

    try:
        print("\n🗑️  Очистка базы данных перед заполнением...")
        flush_all_data(db)

        users = create_users(db)
        client_users = [users["client1@dental-lab.ru"], users["client2@dental-lab.ru"], users["client3@dental-lab.ru"], users["client4@dental-lab.ru"]]
        technician_users = [users["technician1@dental-lab.ru"], users["technician2@dental-lab.ru"], users["technician3@dental-lab.ru"]]
        clients = create_clients(db, users)
        technicians = create_technicians(db, users)
        services = create_services(db)
        orders = create_orders(db, clients, technicians, services, users)
        materials = create_materials(db)
        create_material_requests(db, materials, technicians, users)
        create_reviews(db, clients, orders)
        create_articles(db, users)
        create_knowledge_base(db, users)
        create_promotions(db)
        create_faqs(db)
        create_notifications(db, users, orders)
        create_order_templates(db, clients, services)

        print("\n" + "=" * 60)
        print("База данных успешно заполнена!")
        print(f"   - Пользователей: {len(users)}")
        print(f"   - Клиентов: {len(clients)}")
        print(f"   - Техников: {len(technicians)}")
        print(f"   - Заказов: {len(orders)}")
        print(f"   - Услуг: {len(services['services'])}")
        print(f"   - Отзывов: {db.query(Review).count()}")
        print(f"   - Статей: {db.query(Article).count()}")
        print(f"   - БЗ: {db.query(KnowledgeBase).count()}")
        print(f"   - FAQ: {db.query(Faq).count()}")
        print("\n=== Распределение заказов по клиентам ===")
        for client_user in client_users:
            client = clients.get(client_user.id)
            if client:
                client_order_count = len([o for o in orders if o.client_id == client.id])
                print(f"   {client.clinic_name}: {client_order_count} заказ(ов)")
        print("\n=== Распределение заказов по техникам ===")
        for tech_user in technician_users:
            tech = technicians.get(tech_user.id)
            if tech:
                tech_order_count = len([o for o in orders if o.technician_id == tech.id])
                print(f"   {tech.user.first_name}: {tech_order_count} заказ(ов)")
        print("=" * 60)
    except Exception as e:
        db.rollback()
        print(f"\n❌ Ошибка: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
