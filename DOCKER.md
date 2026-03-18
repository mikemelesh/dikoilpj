# 🐳 Запуск проекта через Docker

## Быстрый старт

### 1. Установка Docker

- **Windows/Mac:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux:** `sudo apt install docker.io docker-compose`

### 2. Запуск

```bash
# Клонируйте репозиторий
git clone <URL_репозитория>
cd dikoilpj

# Запустите всё одной командой
docker-compose up --build
```

### 3. Готово!

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### 4. Остановка

```bash
docker-compose down
```

---

## Основные команды

| Команда | Описание |
|---------|----------|
| `docker-compose up --build` | Запуск с пересборкой |
| `docker-compose up -d` | Запуск в фоновом режиме |
| `docker-compose down` | Остановка |
| `docker-compose down -v` | Остановка с удалением данных БД |
| `docker-compose logs -f` | Просмотр логов |
| `docker-compose ps` | Статус контейнеров |
| `docker-compose restart backend` | Перезапуск backend |

---

## Полезные команды

### Выполнение команд в контейнере

```bash
# Заполнить БД тестовыми данными
docker-compose exec backend python -m app.seed_data_fixed

# Применить миграции
docker-compose exec backend alembic upgrade head

# Войти в shell контейнера
docker-compose exec backend bash

# PostgreSQL shell
docker-compose exec db psql -U postgres -d dental_lab
```

### Логи

```bash
# Все логи
docker-compose logs -f

# Лог конкретного сервиса
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Последние 100 строк
docker-compose logs --tail=100 backend
```

### Очистка

```bash
# Остановить и удалить контейнеры
docker-compose down

# Очистить кэш Docker
docker system prune -a

# Пересобрать без кэша
docker-compose build --no-cache
```

---

## Тестовые учетные данные

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | `admin@dental-lab.ru` | `Admin123!` |
| Manager | `manager1@dental-lab.ru` | `Manager123!` |
| Technician | `technician1@dental-lab.ru` | `Tech123!` |
| Client | `client1@dental-lab.ru` | `Client123!` |

---

## Решение проблем

### Ошибка: "port already in use"

```bash
# Освободите порты
docker-compose down

# Или измените порты в docker-compose.yml
```

### Ошибка: "Cannot start service"

```bash
# Проверьте, что Docker запущен
docker --version

# Перезапустите Docker Desktop
```

### Данные БД устарели

```bash
# Полная очистка и пересоздание
docker-compose down -v
docker-compose up --build
```

### Backend не подключается к БД

Убедитесь, что `depends_on` настроен правильно и БД готова:

```bash
docker-compose logs db
```

---

## Production режим

Для запуска frontend на nginx (порт 80):

```bash
docker-compose --profile production up -d
```

Frontend будет доступен на http://localhost:80

---

## Структура docker-compose.yml

```yaml
services:
  db:           # PostgreSQL 14
    port: 5432
  
  backend:      # FastAPI (Python 3.11)
    port: 8000
  
  frontend:     # React + Vite (Node 18)
    port: 5173
  
  frontend-prod # Nginx (production)
    port: 80
```

---

## Переменные окружения

Создайте `.env` в корне проекта:

```env
JWT_SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://postgres:postgres123@db:5432/dental_lab
```

Или используйте значения по умолчанию из `.env.example`.
