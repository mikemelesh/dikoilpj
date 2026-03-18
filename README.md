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
- `POST /api/auth/register` — Регистрация
- `POST /api/auth/login` — Вход
- `POST /api/auth/refresh` — Обновление токена
- `POST /api/auth/logout` — Выход
- `GET /api/auth/me` — Текущий пользователь

### Orders
- `GET /api/orders` — Список заказов
- `POST /api/orders` — Создать заказ
- `GET /api/orders/{id}` — Детали заказа
- `PATCH /api/orders/{id}/status` — Сменить статус
- `PATCH /api/orders/{id}/assign` — Назначить техника

### Services
- `GET /api/services` — Список услуг
- `POST /api/services` — Создать услугу
- `PUT /api/services/{id}` — Обновить услугу
- `DELETE /api/services/{id}` — Удалить услугу

### И другие...

Полная документация: http://localhost:8000/docs

## 📄 Лицензия

MIT
