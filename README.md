# Система управления зуботехнической лабораторией — краткое описание для пользователя

Документ описывает, **что это за система**, какие **роли** в ней есть, какие **основные сущности (модели/типы)** используются для построения диаграмм, и как устроены ключевые сценарии работы.

> Установка/требования/запуск пропущены (по запросу).

---

## 1) Роли и возможности

Используются роли:
- `guest` — неавторизованный пользователь (только публичные страницы)
- `client` — клиент (создаёт/ведёт свои заказы, повторяет заказы, оставляет отзывы)
- `technician` — зубной техник (ведёт назначенные заказы, меняет статусы, запрашивает материалы, просматривает портфолио)
- `manager` — менеджер (управляет заказами, назначает техников, корректирует цены/состав до подтверждения, управляет справочниками)
- `admin` — администратор (полный контроль: модерация, пользователи, контент, выгрузки/отчёты)

---

## 2) Бизнес-термины

### 2.1. Статусы заказа (`OrderStatus`)
- `new`
- `confirmed`
- `in_progress`
- `review`
- `completed`
- `cancelled`
- `archived`

### 2.2. Приоритет (`OrderPriority`)
- `normal`
- `urgent`
- `critical`

### 2.3. Статусы заявки на материалы (`MaterialRequestStatus`)
- `pending`
- `approved`
- `rejected`
- `issued`

### 2.4. Лояльность (`LoyaltyTier`)
- `bronze`
- `silver`
- `gold`
- `platinum`

---

## 3) Модели (ER) — полный перечень сущностей и их поля

Ниже перечислены **все модели бэкенда** (таблицы SQLAlchemy) из `backend/app/models/*` и их ключевые поля/связи.

### 3.1. `User` (`backend/app/models/user.py`)
**Таблица:** `users`

Поля:
- `id: UUID` (PK)
- `email: str` (unique, index)
- `hashed_password: str` (парольный хэш)
- `role: UserRole` (`guest/client/technician/manager/admin`)
- `first_name: str?`
- `last_name: str?`
- `phone: str?`
- `avatar_url: str?`
- `is_active: bool` (default `True`)
- `created_at: datetime`
- `updated_at: datetime`
- `loyalty_points: int` (default `0`)

Связи/отношения:
- `client_profile: Client` (1-1, uselist=False)
- `technician_profile: Technician` (1-1, uselist=False)
- `managed_orders: List[Order]` (через `Order.manager_id`)
- `action_logs: List[ActionLog]`

---

### 3.2. `Client` (`backend/app/models/client.py`)
**Таблица:** `clients`

Поля:
- `id: int` (PK)
- `user_id: UUID` (FK → `users.id`, unique, not null)
- `clinic_name: str?`
- `address: str?`
- `discount_percent: float` (default `0.0`)
- `total_orders: int` (default `0`)
- `loyalty_tier: str` (default `bronze`)
- `client_type: ClientType` (`physical/legal`)

Связи:
- `user: User`
- `orders: List[Order]`
- `reviews: List[Review]`
- `templates: List[OrderTemplate]`

---

### 3.3. `Technician` (`backend/app/models/technician.py`)
**Таблица:** `technicians`

Поля:
- `id: int` (PK)
- `user_id: UUID` (FK → `users.id`, unique, not null)
- `specialization: str?`
- `experience_years: int` (default `0`)
- `rating: float` (default `0.0`)
- `completed_orders: int` (default `0`)
- `portfolio_description: str?`
- `is_available: bool` (default `True`)

Связи:
- `user: User`
- `orders: List[Order]`
- `material_requests: List[MaterialRequest]`

---

### 3.4. `Order` (`backend/app/models/order.py`)
**Таблица:** `orders`

Поля:
- `id: UUID` (PK)
- `order_number: str` (unique, index)

Связи/внешние ключи:
- `client_id: int` (FK → `clients.id`, not null)
- `technician_id: int?` (FK → `technicians.id`, null allowed)
- `manager_id: UUID?` (FK → `users.id`, null allowed)

Бизнес-поля:
- `status: OrderStatus` (default `new`)
- `priority: OrderPriority` (default `normal`)
- `total_price: Numeric(10,2)` (default `0.0`)
- `discount_amount: Numeric(10,2)` (default `0.0`)
- `final_price: Numeric(10,2)` (default `0.0`)
- `notes: Text?`
- `deadline: date?`

Временные метки:
- `created_at: datetime`
- `updated_at: datetime`
- `completed_at: datetime?`

Связи:
- `client: Client`
- `technician: Technician`
- `manager: User` (через `manager_id`)
- `items: List[OrderItem]`
- `files: List[OrderFile]`
- `status_history: List[OrderStatusHistory]`
- `reviews: List[Review]`

---

### 3.5. `OrderItem` (`backend/app/models/order.py`)
**Таблица:** `order_items`

Поля:
- `id: int` (PK)
- `order_id: UUID` (FK → `orders.id`, not null)
- `service_id: int` (FK → `services.id`, not null)
- `quantity: int` (default `1`)
- `unit_price: Numeric(10,2)`
- `total_price: Numeric(10,2)`
- `specifications: JSONB?`

Связи:
- `order: Order`

---

### 3.6. `OrderFile` (`backend/app/models/order.py`)
**Таблица:** `order_files`

Поля:
- `id: int` (PK)
- `order_id: UUID` (FK → `orders.id`, not null)
- `uploaded_by: UUID` (FK → `users.id`, not null)
- `file_name: str`
- `file_path: str`
- `file_type: str`
- `file_size: int`
- `created_at: datetime`

Связи:
- `order: Order`

---

### 3.7. `OrderStatusHistory` (`backend/app/models/order.py`)
**Таблица:** `order_status_history`

Поля:
- `id: int` (PK)
- `order_id: UUID` (FK → `orders.id`, not null)
- `changed_by: UUID` (FK → `users.id`, not null)
- `old_status: OrderStatus`
- `new_status: OrderStatus`
- `comment: Text?`
- `created_at: datetime`

Связи:
- `order: Order`

---

### 3.8. `MaterialRequest` (`backend/app/models/order.py`)
**Таблица:** `material_requests`

Поля:
- `id: int` (PK)
- `technician_id: int` (FK → `technicians.id`, not null)
- `material_id: int` (FK → `materials.id`, not null)
- `quantity_requested: Numeric` (тип числовой, без точности заданной здесь)
- `status: MaterialRequestStatus` (default `pending`)
- `comment: Text?`
- `created_at: datetime`
- `resolved_by: UUID?` (FK → `users.id`, null allowed)
- `resolved_at: datetime?`

Связи:
- `technician: Technician`
- `material: Material`
- `resolver: User` (через `resolved_by`)

---

### 3.9. `ServiceCategory` (`backend/app/models/service.py`)
**Таблица:** `service_categories`

Поля:
- `id: int` (PK)
- `name: str` (unique, not null)
- `description: Text?`
- `icon_url: str?`
- `sort_order: int` (default `0`)
- `is_active: bool` (default `True`)

Связи:
- `services: List[Service]`

---

### 3.10. `Service` (`backend/app/models/service.py`)
**Таблица:** `services`

Поля:
- `id: int` (PK)
- `category_id: int` (FK → `service_categories.id`, not null)
- `name: str`
- `description: Text?`
- `base_price: Numeric(10,2)`
- `unit: str` (например `шт/этап/работа`)
- `duration_days: int`
- `is_active: bool` (default `True`)
- `created_at: datetime`
- `updated_at: datetime`

Связи:
- `category: ServiceCategory`

---

### 3.11. `Material` (`backend/app/models/material.py`)
**Таблица:** `materials`

Поля:
- `id: int` (PK)
- `name: str`
- `description: str?`
- `unit: str`
- `quantity: Numeric` (default `0.0`)
- `min_quantity: Numeric` (default `0.0`)
- `price_per_unit: Numeric(10,2)` (default `0.0`)
- `supplier: str?`
- `created_at: datetime`
- `updated_at: datetime`

Связи:
- `requests: List[MaterialRequest]`

---

### 3.12. `OrderTemplate` (`backend/app/models/order_template.py`)
**Таблица:** `order_templates`


Поля:
- `id: int` (PK)
- `client_id: int` (FK → `clients.id`, not null, index)
- `name: str` (not null, index)
- `items: JSONB` (default `list`, фактически список)
- `notes: Text?`
- `created_at: datetime`

Связи:
- `client: Client`

---

### 3.13. `Review` (`backend/app/models/review.py`)
**Таблица:** `reviews`

Поля:
- `id: int` (PK)
- `client_id: int` (FK → `clients.id`, not null)
- `order_id: UUID?` (FK → `orders.id`, nullable)
- `rating: int` (1–5)
- `text: Text?`
- `is_moderated: bool` (default `False`)
- `is_published: bool` (default `False`)
- `created_at: datetime`

Связи:
- `client: Client`
- `order: Order`

---

### 3.14. `Article` (`backend/app/models/article.py`)
**Таблица:** `articles`

Поля:
- `id: int` (PK)
- `title: str`
- `slug: str` (unique, index)
- `content: Text`
- `category: str?`
- `author_id: UUID` (FK → `users.id`)
- `is_published: bool` (default `False`)
- `created_at: datetime`
- `updated_at: datetime`

---

### 3.15. `KnowledgeBase` (`backend/app/models/knowledge.py`)
**Таблица:** `knowledge_base`

Поля:
- `id: int` (PK)
- `title: str`
- `content: Text`
- `category: str?`
- `tags: ARRAY(String)?`
- `created_by: UUID` (FK → `users.id`)
- `is_published: bool` (default `True`)
- `created_at: datetime`
- `updated_at: datetime`

---

### 3.16. `Faq` (`backend/app/models/faq.py`)
**Таблица:** `faqs`

Поля:
- `id: int` (PK)
- `question: str`
- `answer: Text`
- `category: str?`
- `sort_order: int` (default `0`)
- `is_published: bool` (default `True`)
- `created_at: datetime`
- `updated_at: datetime`

---

### 3.17. `Promotion` (`backend/app/models/promotion.py`)
**Таблица:** `promotions`

Поля:
- `id: int` (PK)
- `title: str`
- `description: str?`
- `discount_percent: float`
- `start_date: date`
- `end_date: date`
- `is_active: bool` (default `True`)
- `applies_to: PromotionAppliesTo` (`all/service/category`, default `all`)
- `target_id: int?`

---

### 3.18. `Notification` (`backend/app/models/notification.py`)
**Таблица:** `notifications`

Поля:
- `id: int` (PK)
- `recipient_id: UUID` (FK → `users.id`)
- `sender_id: UUID?` (FK → `users.id`)
- `title: str` (default `"Уведомление"`)
- `message: Text`
- `notification_type: str` (default `order_status`)
- `order_id: UUID?` (FK → `orders.id`)
- `is_read: bool` (default `False`)
- `created_at: datetime (timezone=True)`

Связи:
- `recipient: User`
- `sender: User`
- `order: Order`

---

### 3.19. `ActionLog` (`backend/app/models/logging.py`)
**Таблица:** `action_logs`

Поля:
- `id: int` (PK)
- `user_id: UUID?` (FK → `users.id`)
- `action_type: str`
- `entity_type: str`
- `entity_id: str?`
- `description: Text?`
- `ip_address: str?`
- `user_agent: str?`
- `created_at: datetime`

Связи:
- `user: User`

---

## 4) Модули (что делают на уровне логики)


### 4.1. Заказы
- создаются клиентом (статус `new`)
- редактирование состава/цены до подтверждения (логика привязана к статусу `new`)
- назначение техника менеджером/админом
- переходы статусов с записью в `OrderStatusHistory`

### 4.2. Материалы
- техник создаёт `MaterialRequest`
- менеджер/админ принимает решение по заявке

### 4.3. Услуги
- каталог `ServiceCategory` → `Service`

### 4.4. Шаблоны заказов
- `OrderTemplate.items` (JSONB) хранит набор позиций для быстрого создания заказа

### 4.5. Контент
- статьи (`Article`), база знаний (`KnowledgeBase`), FAQ (`Faq`)
- публикация/видимость управляются по флагу `is_published` (для публичной части)

### 4.6. Отзывы
- клиент создаёт `Review`, админ модерирует (публикует/скрывает)

### 4.7. Промо
- `Promotion` применяется в зависимости от `applies_to` и `target_id`

### 4.8. Уведомления
- события системы создают `Notification` для пользователей
- пользователь помечает уведомления как прочитанные

### 4.9. Экспорт/отчёты и аналитика
- выгрузки строятся сервером из БД (Word/Excel)
- доступ ограничивается ролями

---

## 5) Типы на фронтенде (полезно для диаграмм)

В `frontend/src/types/index.ts` определены соответствия доменных значений:
- `Role`
- `OrderStatus`
- `Priority`
- `LoyaltyTier`
- `MaterialRequestStatus`

---

---

MIT


