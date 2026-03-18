# Dental Lab - Система управления зуботехнической лабораторией

Full-stack приложение для управления зуботехнической лабораторией.

## 📋 Требования

- Python 3.10+
- PostgreSQL 14+
- Node.js 18+
- npm 9+

## 🚀 Быстрый старт

### Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Установить зависимости
pip install -r requirements.txt

# Скопировать .env.example в .env и настроить
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Создать базу данных
psql -U postgres -c "CREATE DATABASE dental_lab;"

# Применить миграции
alembic upgrade head

# Создать администратора по умолчанию (опционально)
python -m app.create_admin

# Запустить сервер
uvicorn app.main:app --reload
```

Backend доступен на: http://localhost:8000
Документация API: http://localhost:8000/docs

**Учетная запись администратора по умолчанию:**
- Email: `admin@dental-lab.ru`
- Пароль: `Admin123!`

### Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Скопировать .env.example в .env
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Запустить dev-сервер
npm run dev

# Собрать production версию
npm run build
```

Frontend доступен на: http://localhost:5173

## 📁 Структура проекта

```
dikoilpj/
├── backend/
│   ├── app/
│   │   ├── models/       # SQLAlchemy модели
│   │   ├── schemas/      # Pydantic схемы
│   │   ├── routers/      # FastAPI роутеры
│   │   ├── dependencies/ # DI зависимости
│   │   └── utils/        # Утилиты
│   ├── alembic/          # Миграции БД
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/          # API клиенты
│   │   ├── components/   # React компоненты
│   │   ├── pages/        # Страницы
│   │   ├── router/       # React Router
│   │   ├── stores/       # Zustand stores
│   │   ├── types/        # TypeScript типы
│   │   └── utils/        # Утилиты
│   └── package.json
└── README.md
```

## 🔐 Роли пользователей

| Роль | Описание | Как получить |
|------|----------|--------------|
| `admin` | Полный доступ ко всем функциям | По умолчанию: `admin@dental-lab.ru` / `Admin123!` |
| `manager` | Управление заказами, клиентами, услугами, акциями | Регистрация на сайте или тестовые: `manager1@dental-lab.ru` / `Manager123!` |
| `technician` | Просмотр назначенных заказов, запросы материалов | Регистрация на сайте или тестовые: `technician1@dental-lab.ru` / `Tech123!` |
| `client` | Создание заказов, просмотр своих заказов | Регистрация на сайте (по умолчанию) или тестовые: `client1@dental-lab.ru` / `Client123!` |
| `guest` | Только публичные страницы | Без регистрации |

### 📊 Тестовые данные

После запуска скрипта `seed_data` в базе данных создаются:
- **10 пользователей** (1 админ, 2 менеджера, 3 техника, 4 клиента)
- **4 клиента** с профилями клиник
- **3 техника** с разными специализациями
- **5 категорий услуг** и **19 услуг**
- **9 заказов** с разными статусами (new, confirmed, in_progress, review, completed, archived)
- **8 материалов** (один с низким остатком)
- **4 запроса на материалы** (pending, approved, rejected)
- **4 отзыва** (опубликованные)
- **4 статьи** в блоге
- **3 акции** (активные)

Для заполнения тестовыми данными выполните:
```bash
cd backend
venv\Scripts\activate
python -m app.seed_data
```

## 📊 Основные возможности

### Для клиентов
- Создание и просмотр заказов
- Отслеживание статуса заказа
- Программа лояльности
- Отзывы

### Для техников
- Просмотр назначенных заказов
- Смена статуса заказа
- Запросы на материалы
- База знаний

### Для менеджеров
- Управление всеми заказами
- Назначение техников
- Диаграмма Ганта
- Управление клиентами, услугами, акциями

### Для администраторов
- Управление пользователями
- Модерация отзывов
- Просмотр логов
- Резервное копирование

## 🔧 Технологии

**Backend:**
- FastAPI
- SQLAlchemy + PostgreSQL
- Alembic (миграции)
- Pydantic v2
- JWT auth (access + refresh tokens)
- bcrypt (passlib)
- SlowAPI (rate limiting)

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- TanStack Query
- Zustand (state management)
- React Hook Form + Zod
- React Router v6
- Recharts (графики)

## 📝 API Endpoints

### Auth

#### Регистрация пользователя
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "Иван",
  "last_name": "Иванов",
  "phone": "+7 (999) 123-45-67",
  "role": "client"  // client, technician, manager (опционально)
}
```

**Ответ (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

#### Вход
```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=SecurePass123!
```

#### Обновление токена
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Выход
```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

#### Текущий пользователь
```http
GET /api/auth/me
Authorization: Bearer {access_token}
```

---

### Orders

#### Список заказов
```http
GET /api/orders?status=new&priority=urgent&page=1&limit=20
Authorization: Bearer {access_token}
```

**Параметры:**
- `status` — фильтр по статусу (new, confirmed, in_progress, review, completed, cancelled, archived)
- `priority` — фильтр по приоритету (normal, urgent, critical)
- `page` — номер страницы (default: 1)
- `limit` — количество на странице (default: 20, max: 100)

#### Создать заказ
```http
POST /api/orders
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "items": [
    {
      "service_id": 1,
      "quantity": 2,
      "specifications": {
        "color": "A2",
        "material": "Цирконий"
      }
    },
    {
      "service_id": 5,
      "quantity": 1
    }
  ],
  "notes": "Срочный заказ, дедлайн до пятницы",
  "deadline": "2024-12-31",
  "priority": "urgent"  // normal, urgent, critical
}
```

**Ответ (201):**
```json
{
  "id": "c45b64e7-551e-4557-9cf2-ac069f67924b",
  "order_number": "ORD-20241218-A1B2",
  "client_id": 1,
  "client_name": "Иван Иванов",
  "status": "new",
  "priority": "urgent",
  "total_price": 15000.00,
  "discount_amount": 0,
  "final_price": 15000.00,
  "items": [
    {
      "service_id": 1,
      "service_name": "Металлокерамическая коронка",
      "quantity": 2,
      "unit_price": 5000.00,
      "total_price": 10000.00
    }
  ],
  "created_at": "2024-12-18T10:30:00Z"
}
```

#### Детали заказа
```http
GET /api/orders/{order_id}
Authorization: Bearer {access_token}
```

#### Сменить статус заказа
```http
PATCH /api/orders/{order_id}/status
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "new_status": "confirmed",  // new, confirmed, in_progress, review, completed, cancelled, archived
  "comment": "Заказ подтверждён, техник назначен"
}
```

#### Назначить техника
```http
PATCH /api/orders/{order_id}/assign
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "technician_id": 3
}
```

---

### Services

#### Список услуг
```http
GET /api/services?category_id=1&is_active=true&search=коронка&page=1&limit=20
```

**Ответ:**
```json
{
  "items": [
    {
      "id": 1,
      "category_id": 1,
      "category_name": "Металлокерамика",
      "name": "Металлокерамическая коронка",
      "description": "Коронка из диоксида циркония",
      "base_price": 5000.00,
      "unit": "шт",
      "duration_days": 5,
      "is_active": true
    }
  ],
  "total": 19,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

#### Создать услугу
```http
POST /api/services
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "category_id": 1,
  "name": "Винир E-max",
  "description": "Керамический винир IPS E-max",
  "base_price": 15000.00,
  "unit": "шт",
  "duration_days": 7,
  "is_active": true
}
```

**Доступно:** manager, admin

#### Обновить услугу
```http
PUT /api/services/{service_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Винир E-max Premium",
  "base_price": 18000.00,
  "is_active": true
}
```

#### Удалить услугу
```http
DELETE /api/services/{service_id}
Authorization: Bearer {access_token}
```

---

### Material Requests

#### Создать запрос на материал
```http
POST /api/materials/requests
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "material_id": 3,
  "quantity_requested": 5,
  "comment": "Необходимо для срочного заказа"
}
```

**Ответ (201):**
```json
{
  "id": 12,
  "technician_id": 3,
  "technician_name": "Алексей Петров",
  "material_id": 3,
  "material_name": "Диоксид циркония",
  "quantity_requested": 5,
  "status": "pending",  // pending, approved, rejected, issued
  "comment": "Необходимо для срочного заказа",
  "created_at": "2024-12-18T11:00:00Z"
}
```

**Доступно:** technician

#### Список запросов
```http
GET /api/materials/requests?status=pending&technician_id=3
Authorization: Bearer {access_token}
```

#### Обработать запрос
```http
PATCH /api/materials/requests/{request_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "status": "approved",  // approved, rejected
  "comment": "Одобрено, выдам завтра"
}
```

**Доступно:** manager, admin

---

### Users (Admin)

#### Изменить роль пользователя
```http
PATCH /api/users/{user_id}/role
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "role": "manager"  // guest, client, technician, manager, admin
}
```

**Ответ (200):**
```json
{
  "id": "f4982b73-6fe3-47ba-acb2-1fab312108f0",
  "email": "user@example.com",
  "role": "manager",
  "first_name": "Иван",
  "last_name": "Иванов",
  "is_active": true,
  "created_at": "2024-01-15T08:00:00Z"
}
```

**Доступно:** admin

**Примечание:** Нельзя изменить роль другого администратора (защита от случайного удаления прав)

---

### Полная документация

Откройте Swagger UI: http://localhost:8000/docs

Или ReDoc: http://localhost:8000/redoc

## 📄 Лицензия

MIT
