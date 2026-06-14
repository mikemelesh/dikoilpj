"""
Дополнительные демо-данные для наполненной базы.
Вызывается из seed_data.seed_all() после базового набора.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from .models.article import Article
from .models.client import Client
from .models.order import (
    MaterialRequest,
    MaterialRequestStatus,
    Order,
    OrderItem,
    OrderPriority,
    OrderStatus,
    OrderStatusHistory,
)
from .models.promotion import Promotion, PromotionAppliesTo
from .models.review import Review
from .models.service import Service
from .models.technician import Technician
from .models.user import User, UserRole, LoyaltyTier
from .seed_content import BULK_ARTICLES, BULK_EXTRA_USERS
from .utils.loyalty import recalculate_all_clients_loyalty
from .utils.security import get_password_hash

random.seed(42)

BULK_ORDER_TARGET = 120
BULK_MIN_EXISTING = 80

EXTRA_USERS = BULK_EXTRA_USERS

EXTRA_CLIENTS = [
    ("client5@dental-lab.ru", "Стоматология «Белый зуб»", "г. Минск, пр. Независимости, 45"),
    ("client6@dental-lab.ru", "Клиника «ДентаЛюкс»", "г. Минск, ул. Кальварийская, 12"),
    ("client7@dental-lab.ru", "Центр «Эстетика улыбки»", "г. Гомель, ул. Советская, 88"),
    ("client8@dental-lab.ru", "Стоматология «МедДент»", "г. Брест, ул. Машерова, 5"),
    ("client9@dental-lab.ru", "Клиника «Ортодонт+»", "г. Витебск, ул. Ленина, 33"),
    ("client10@dental-lab.ru", "Зубной центр «Премиум»", "г. Минск, ул. Притыцкого, 90"),
    ("client11@dental-lab.ru", "Стоматология «Семейная»", "г. Могилёв, ул. Первомайская, 21"),
    ("client12@dental-lab.ru", "Клиника «Имплант Про»", "г. Минск, ул. Сурганова, 57"),
]

EXTRA_TECHNICIANS = [
    ("technician4@dental-lab.ru", "CAD/CAM и цирконий", 6, 4.7, 112, True),
    ("technician5@dental-lab.ru", "Эстетическая керамика", 9, 4.85, 178, True),
]

CLINIC_NOTES = [
    "Просьба согласовать оттенок до начала работы.",
    "Повторный заказ, как в прошлый раз.",
    "Нужна срочная доставка курьером.",
    "Пациент VIP — особый контроль качества.",
    "Приложены фото в чате клиники.",
    None,
    None,
]

STATUS_POOL = [
    (OrderStatus.NEW, 14),
    (OrderStatus.CONFIRMED, 16),
    (OrderStatus.IN_PROGRESS, 22),
    (OrderStatus.REVIEW, 12),
    (OrderStatus.COMPLETED, 28),
    (OrderStatus.CANCELLED, 4),
    (OrderStatus.ARCHIVED, 4),
]

PRIORITY_POOL = [
    (OrderPriority.NORMAL, 70),
    (OrderPriority.URGENT, 22),
    (OrderPriority.CRITICAL, 8),
]


def _weighted_choice(pool):
    items, weights = zip(*pool)
    return random.choices(items, weights=weights, k=1)[0]


def create_extra_users(db: Session) -> dict:
    print("\n[DEMO] Дополнительные пользователи...")
    users = {}
    for data in EXTRA_USERS:
        existing = db.query(User).filter(User.email == data["email"]).first()
        if existing:
            users[data["email"]] = existing
            continue
        user = User(
            email=data["email"],
            hashed_password=get_password_hash(data["password"]),
            role=data["role"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            phone=data["phone"],
            is_active=True,
        )
        db.add(user)
        db.flush()
        users[data["email"]] = user
        print(f"  + {data['email']}")
    db.commit()
    return users


def create_extra_profiles(db: Session, users: dict) -> tuple[dict, dict]:
    print("\n[DEMO] Дополнительные профили клиентов и техников...")
    clients = {}
    technicians = {}

    for email, clinic, address in EXTRA_CLIENTS:
        user = users.get(email) or db.query(User).filter(User.email == email).first()
        if not user:
            continue
        existing = db.query(Client).filter(Client.user_id == user.id).first()
        if existing:
            clients[user.id] = existing
            continue
        client = Client(
            user_id=user.id,
            clinic_name=clinic,
            address=address,
            discount_percent=0,
            loyalty_tier=LoyaltyTier.BRONZE.value,
            total_orders=0,
        )
        db.add(client)
        db.flush()
        clients[user.id] = client
        print(f"  + клиент: {clinic}")

    for email, spec, exp, rating, completed, available in EXTRA_TECHNICIANS:
        user = users.get(email) or db.query(User).filter(User.email == email).first()
        if not user:
            continue
        existing = db.query(Technician).filter(Technician.user_id == user.id).first()
        if existing:
            technicians[user.id] = existing
            continue
        tech = Technician(
            user_id=user.id,
            specialization=spec,
            experience_years=exp,
            rating=rating,
            completed_orders=completed,
            portfolio_description=f"Специализация: {spec}.",
            is_available=available,
        )
        db.add(tech)
        db.flush()
        technicians[user.id] = tech
        print(f"  + техник: {user.first_name} {user.last_name}")

    db.commit()
    return clients, technicians


def create_bulk_orders(
    db: Session,
    clients: dict,
    technicians: dict,
    users: dict,
) -> list:
    existing = db.query(Order).count()
    if existing >= BULK_MIN_EXISTING:
        need = max(0, BULK_ORDER_TARGET - existing)
        if need == 0:
            print(f"\n[DEMO] Заказов уже {existing}, пропуск bulk-генерации")
            return db.query(Order).all()
    else:
        need = BULK_ORDER_TARGET - existing

    print(f"\n[DEMO] Генерация {need} заказов (сейчас в БД: {existing})...")

    all_clients = list(db.query(Client).all())
    all_technicians = list(db.query(Technician).all())
    services = list(db.query(Service).filter(Service.is_active == True).all())
    managers = [
        users.get("manager1@dental-lab.ru"),
        users.get("manager2@dental-lab.ru"),
    ]
    managers = [m for m in managers if m]

    if not all_clients or not services:
        print("  ! Нет клиентов или услуг для генерации")
        return []

    created = []
    now = datetime.now(timezone.utc)

    for i in range(need):
        client = random.choice(all_clients)
        status = _weighted_choice(STATUS_POOL)
        priority = _weighted_choice(PRIORITY_POOL)
        manager = random.choice(managers) if managers else None

        tech = None
        if status not in (OrderStatus.NEW,) and all_technicians:
            tech = random.choice(all_technicians)

        days_ago = random.randint(0, 90)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 12))

        deadline_days = random.choice([3, 5, 7, 10, 14, 21])
        if status in (OrderStatus.COMPLETED, OrderStatus.ARCHIVED, OrderStatus.CANCELLED):
            deadline = (created_at + timedelta(days=deadline_days)).date()
        elif random.random() < 0.12:
            deadline = (now - timedelta(days=random.randint(1, 5))).date()
        else:
            deadline = (now + timedelta(days=random.randint(-2, deadline_days))).date()

        picked_services = random.sample(services, k=random.randint(1, min(3, len(services))))
        total_price = Decimal("0")
        order_items = []
        for svc in picked_services:
            qty = 3 if "3 ед" in svc.name else random.randint(1, 2)
            item_total = Decimal(str(svc.base_price)) * qty
            total_price += item_total
            order_items.append((svc, qty, item_total))

        discount_pct = Decimal(str(client.discount_percent or 0))
        discount_amount = total_price * discount_pct / Decimal("100")
        final_price = total_price - discount_amount

        order_number = f"ORD-{created_at.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        order = Order(
            order_number=order_number,
            client_id=client.id,
            technician_id=tech.id if tech else None,
            manager_id=manager.id if manager else None,
            status=status,
            priority=priority,
            total_price=float(total_price),
            discount_amount=float(discount_amount),
            final_price=float(final_price),
            notes=random.choice(CLINIC_NOTES),
            deadline=deadline,
            created_at=created_at,
        )

        if status in (OrderStatus.COMPLETED, OrderStatus.ARCHIVED):
            order.completed_at = created_at + timedelta(days=random.randint(3, max(5, deadline_days)))

        db.add(order)
        db.flush()

        for svc, qty, item_total in order_items:
            db.add(
                OrderItem(
                    order_id=order.id,
                    service_id=svc.id,
                    quantity=qty,
                    unit_price=svc.base_price,
                    total_price=float(item_total),
                )
            )

        db.add(
            OrderStatusHistory(
                order_id=order.id,
                old_status=OrderStatus.NEW,
                new_status=OrderStatus.NEW,
                changed_by=manager.id if manager else None,
                comment="Заказ создан",
                created_at=created_at,
            )
        )
        if status != OrderStatus.NEW:
            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    old_status=OrderStatus.NEW,
                    new_status=status,
                    changed_by=manager.id if manager else None,
                    comment=f"Статус: {status.value}",
                    created_at=created_at + timedelta(hours=random.randint(1, 48)),
                )
            )

        created.append(order)
        if (i + 1) % 25 == 0:
            print(f"  ... {i + 1}/{need}")

    db.commit()
    print(f"  OK: создано {len(created)} заказов (всего в БД: {db.query(Order).count()})")
    return created


def create_bulk_reviews(db: Session) -> int:
    print("\n[DEMO] Дополнительные отзывы...")
    completed = (
        db.query(Order)
        .filter(Order.status == OrderStatus.COMPLETED)
        .order_by(Order.completed_at.desc())
        .limit(40)
        .all()
    )
    texts = [
        "Отличная работа, рекомендуем лабораторию коллегам.",
        "Качество на высоте, сроки выдержаны.",
        "Небольшая задержка, но результат отличный.",
        "Удобный личный кабинет и прозрачные цены.",
        "Постоянно работаем — всё стабильно.",
    ]
    count = 0
    for order in completed:
        if random.random() > 0.55:
            continue
        existing = db.query(Review).filter(Review.order_id == order.id).first()
        if existing:
            continue
        review = Review(
            client_id=order.client_id,
            order_id=order.id,
            rating=random.choices([4, 5, 5, 5, 3], k=1)[0],
            text=random.choice(texts),
            is_moderated=random.random() > 0.15,
            is_published=random.random() > 0.1,
        )
        db.add(review)
        count += 1
    db.commit()
    print(f"  OK: +{count} отзывов")
    return count


def create_bulk_material_requests(db: Session) -> int:
    from .models.material import Material

    print("\n[DEMO] Дополнительные запросы материалов...")
    materials = db.query(Material).all()
    techs = db.query(Technician).all()
    manager = db.query(User).filter(User.email == "manager1@dental-lab.ru").first()
    if not materials or not techs:
        return 0

    statuses = [
        MaterialRequestStatus.PENDING,
        MaterialRequestStatus.PENDING,
        MaterialRequestStatus.APPROVED,
        MaterialRequestStatus.REJECTED,
        MaterialRequestStatus.ISSUED,
    ]
    count = 0
    for _ in range(18):
        tech = random.choice(techs)
        mat = random.choice(materials)
        st = random.choice(statuses)
        req = MaterialRequest(
            technician_id=tech.id,
            material_id=mat.id,
            quantity_requested=random.randint(10, 120),
            status=st,
            comment=random.choice(["Для текущих заказов", "Плановое пополнение", None]),
            created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(0, 30)),
        )
        if st != MaterialRequestStatus.PENDING and manager:
            req.resolved_by = manager.id
            req.resolved_at = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 5))
        db.add(req)
        count += 1
    db.commit()
    print(f"  OK: +{count} запросов")
    return count


def create_extra_content(db: Session, users: dict) -> None:
    print("\n[DEMO] Дополнительные статьи и акции...")
    manager = users.get("manager1@dental-lab.ru") or db.query(User).filter(User.role == UserRole.MANAGER).first()
    today = datetime.now().date()

    for article_data in BULK_ARTICLES:
        if db.query(Article).filter(Article.slug == article_data["slug"]).first():
            continue
        db.add(
            Article(
                title=article_data["title"],
                slug=article_data["slug"],
                category=article_data["category"],
                content=article_data["content"],
                author_id=manager.id if manager else None,
                is_published=article_data["is_published"],
            )
        )

    promos = [
        ("Весенняя скидка 10%", "На все услуги каталога", 10, -10, 45, PromotionAppliesTo.ALL),
        ("Коронка E-max — выгоднее", "При заказе от 2 единиц", 8, -5, 30, PromotionAppliesTo.SERVICE),
        ("Ортодонтия: −12%", "На ретенционные конструкции", 12, 0, 60, PromotionAppliesTo.CATEGORY),
    ]
    for title, desc, pct, start_off, end_off, applies in promos:
        if db.query(Promotion).filter(Promotion.title == title).first():
            continue
        db.add(
            Promotion(
                title=title,
                description=desc,
                discount_percent=pct,
                start_date=today + timedelta(days=start_off),
                end_date=today + timedelta(days=end_off),
                applies_to=applies,
                is_active=True,
            )
        )

    db.commit()
    print("  OK: статьи и акции")


def seed_bulk_demo(db: Session, users: dict, clients: dict, technicians: dict) -> None:
    """Полный цикл демо-наполнения."""
    extra_users = create_extra_users(db)
    users = {**users, **extra_users}
    extra_clients, extra_techs = create_extra_profiles(db, users)
    clients = {**clients, **extra_clients}
    technicians = {**technicians, **extra_techs}

    all_clients = {c.user_id: c for c in db.query(Client).all()}
    all_techs = {t.user_id: t for t in db.query(Technician).all()}

    create_bulk_orders(db, all_clients, all_techs, users)
    create_bulk_reviews(db)
    create_bulk_material_requests(db)
    create_extra_content(db, users)

    print("\n[DEMO] Пересчёт программы лояльности...")
    n = recalculate_all_clients_loyalty(db)
    print(f"  OK: обновлено клиентов: {n}")
