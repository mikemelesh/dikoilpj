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

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

from sqlalchemy.orm import Session
from .database import SessionLocal, engine, Base
from .models.user import User, UserRole, LoyaltyTier
from .models.client import Client
from .models.technician import Technician
from .models.service import Service, ServiceCategory
from .models.order import Order, OrderItem, OrderStatus, OrderPriority, OrderStatusHistory
from .models.material import Material
from .models.order import MaterialRequest, MaterialRequestStatus
from .models.review import Review
from .models.article import Article
from .models.promotion import Promotion, PromotionAppliesTo
from .models.knowledge import KnowledgeBase
from .utils.security import get_password_hash


def create_users(db: Session) -> dict:
    """Создание тестовых пользователей."""
    print("📝 Создание пользователей...")

    users_data = [
        {"email": "admin@dental-lab.ru", "password": "Admin123!", "role": UserRole.ADMIN, "first_name": "Админ", "last_name": "Главный", "phone": "+7 (999) 000-00-00"},
        {"email": "manager1@dental-lab.ru", "password": "Manager123!", "role": UserRole.MANAGER, "first_name": "Иван", "last_name": "Менеджеров", "phone": "+7 (999) 111-11-11"},
        {"email": "manager2@dental-lab.ru", "password": "Manager123!", "role": UserRole.MANAGER, "first_name": "Мария", "last_name": "Управленцева", "phone": "+7 (999) 222-22-22"},
        {"email": "technician1@dental-lab.ru", "password": "Tech123!", "role": UserRole.TECHNICIAN, "first_name": "Алексей", "last_name": "Техников", "phone": "+7 (999) 333-33-33"},
        {"email": "technician2@dental-lab.ru", "password": "Tech123!", "role": UserRole.TECHNICIAN, "first_name": "Дмитрий", "last_name": "Мастеров", "phone": "+7 (999) 444-44-44"},
        {"email": "technician3@dental-lab.ru", "password": "Tech123!", "role": UserRole.TECHNICIAN, "first_name": "Елена", "last_name": "Зубова", "phone": "+7 (999) 555-55-55"},
        {"email": "client1@dental-lab.ru", "password": "Client123!", "role": UserRole.CLIENT, "first_name": "Петр", "last_name": "Клиентов", "phone": "+7 (999) 666-66-66"},
        {"email": "client2@dental-lab.ru", "password": "Client123!", "role": UserRole.CLIENT, "first_name": "Анна", "last_name": "Стоматологова", "phone": "+7 (999) 777-77-77"},
        {"email": "client3@dental-lab.ru", "password": "Client123!", "role": UserRole.CLIENT, "first_name": "Сергей", "last_name": "Врачев", "phone": "+7 (999) 888-88-88"},
        {"email": "client4@dental-lab.ru", "password": "Client123!", "role": UserRole.CLIENT, "first_name": "Ольга", "last_name": "Улыбкина", "phone": "+7 (999) 999-99-99"},
    ]

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

    categories_data = [
        {"name": "Несъемные протезы", "description": "Коронки, мосты, виниры", "icon_url": None, "sort_order": 1},
        {"name": "Съемные протезы", "description": "Частичные и полные протезы", "icon_url": None, "sort_order": 2},
        {"name": "Имплантация", "description": "Услуги по имплантации", "icon_url": None, "sort_order": 3},
        {"name": "Ортодонтия", "description": "Брекеты, элайнеры", "icon_url": None, "sort_order": 4},
        {"name": "Дополнительные услуги", "description": "Прочие услуги", "icon_url": None, "sort_order": 5},
    ]

    categories = {}
    for cat_data in categories_data:
        existing = db.query(ServiceCategory).filter(ServiceCategory.name == cat_data["name"]).first()
        if existing:
            categories[cat_data["name"]] = existing
            continue

        category = ServiceCategory(
            name=cat_data["name"],
            description=cat_data["description"],
            icon_url=cat_data["icon_url"],
            sort_order=cat_data["sort_order"],
            is_active=True,
        )
        db.add(category)
        db.flush()
        categories[category.name] = category
        print(f"  ✅ Категория: {category.name}")

    db.commit()

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
        ],
        1: [  # client2 - 5 заказов
            {"technician_idx": 1, "status": OrderStatus.IN_PROGRESS, "priority": OrderPriority.URGENT, "services": ["Винир керамический"], "notes": "Важный клиент", "deadline_days": 10},
            {"technician_idx": 2, "status": OrderStatus.REVIEW, "priority": OrderPriority.NORMAL, "services": ["Бюгельный протез"], "notes": "Готов к проверке", "deadline_days": 0},
            {"technician_idx": 0, "status": OrderStatus.COMPLETED, "priority": OrderPriority.NORMAL, "services": ["Коронка металлокерамическая"], "notes": "Успешно выполнен", "deadline_days": 7, "completed_days_ago": 10},
            {"technician_idx": 1, "status": OrderStatus.NEW, "priority": OrderPriority.NORMAL, "services": ["Полный съемный протез"], "notes": "Новый заказ", "deadline_days": 14},
            {"technician_idx": None, "status": OrderStatus.CONFIRMED, "priority": OrderPriority.NORMAL, "services": ["Абатмент стандартный"], "notes": "Ожидает назначения техника", "deadline_days": 7},
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

            # Генерация номера заказа
            order_number = f"ORD-{order_created_at.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

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

    reviews_data = [
        {"client_idx": 0, "order_idx": 6, "rating": 5, "text": "Отличное качество! Все сроки соблюдены. Буду заказывать еще."},
        {"client_idx": 1, "order_idx": 7, "rating": 4, "text": "Хорошая работа, но немного задержали срок."},
        {"client_idx": 2, "order_idx": 5, "rating": 5, "text": "Превосходное качество керамики. Клиент доволен!"},
        {"client_idx": 3, "order_idx": 4, "rating": 5, "text": "Профессиональный подход к работе. Рекомендую!"},
    ]

    reviews = []
    client_ids = list(clients.keys())

    for rev_data in reviews_data:
        if rev_data["client_idx"] >= len(client_ids):
            continue

        client = clients[client_ids[rev_data["client_idx"]]]
        order = orders[rev_data["order_idx"]] if rev_data["order_idx"] < len(orders) else None

        review = Review(
            client_id=client.id,
            order_id=order.id if order else None,
            rating=rev_data["rating"],
            text=rev_data["text"],
            is_moderated=True,
            is_published=True,
        )
        db.add(review)
        db.flush()
        reviews.append(review)
        print(f"  ✅ Отзыв: {client.clinic_name} - {rev_data['rating']}⭐")

    db.commit()
    return reviews


def create_articles(db: Session, users: dict) -> list:
    """Создание статей."""
    print("\nСоздание статей...")

    articles_data = [
        {"title": "Современные материалы в зуботехнической лаборатории", "slug": "sovremennye-materialy", "category": "Материалы", "content": "# Современные материалы\n\nВ современной стоматологии используются различные материалы...", "is_published": True},
        {"title": "Как ухаживать за зубными протезами", "slug": "kak-uhazhivat-za-protezami", "category": "Уход", "content": "# Уход за протезами\n\nПравильный уход продлевает срок службы протезов...", "is_published": True},
        {"title": "Этапы изготовления коронки", "slug": "etapy-izgotovleniya-koronki", "category": "Технология", "content": "# Этапы работы\n\nПроцесс изготовления коронки включает несколько этапов...", "is_published": True},
        {"title": "Новое оборудование в нашей лаборатории", "slug": "novoe-oborudovanie", "category": "Новости", "content": "# Обновление парка\n\nМы установили новый 3D принтер...", "is_published": True},
    ]

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

    kb_data = [
        {"title": "Техника безопасности при работе с полимерами", "category": "Безопасность", "content": "# Правила безопасности\n\n1. Используйте перчатки\n2. Работайте в проветриваемом помещении...", "tags": ["безопасность", "полимеры"]},
        {"title": "Работа с диоксидом циркония", "category": "Материалы", "content": "# Обработка циркония\n\nТемпература обжига: 1500°C...", "tags": ["цирконий", "технология"]},
        {"title": "Устранение сколов керамики", "category": "Ремонт", "content": "# Ремонт сколов\n\nИспользуйте специальный ремонтный состав...", "tags": ["ремонт", "керамика"]},
    ]

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

    today = date.today()

    promotions_data = [
        {"title": "Скидка 15% на циркониевые коронки", "description": "При заказе от 3-х единиц", "discount_percent": 15, "start_days": -5, "end_days": 25, "applies_to": "service", "target_id": None},
        {"title": "Новогодняя акция", "description": "Скидка 20% на все услуги", "discount_percent": 20, "start_days": -30, "end_days": 10, "applies_to": "all", "target_id": None},
        {"title": "Бесплатная консультация техника", "description": "При первом заказе", "discount_percent": 0, "start_days": -1, "end_days": 60, "applies_to": "all", "target_id": None},
    ]

    promotions = []
    for promo_data in promotions_data:
        existing = db.query(Promotion).filter(Promotion.title == promo_data["title"]).first()
        if existing:
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


def run_seed():
    """Запуск заполнения БД."""
    print("=" * 60)
    print("Запуск заполнения базы данных (индивидуальное распределение)...")
    print("=" * 60)

    db = SessionLocal()
    client_users = []  # Глобальные переменные для статистики
    technician_users = []
    
    try:
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

        print("\n" + "=" * 60)
        print("База данных успешно заполнена!")
        print(f"   - Пользователей: {len(users)}")
        print(f"   - Клиентов: {len(clients)}")
        print(f"   - Техников: {len(technicians)}")
        print(f"   - Заказов: {len(orders)}")
        print(f"   - Услуг: {len(services['services'])}")
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
