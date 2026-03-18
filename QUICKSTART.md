# 🚀 Быстрый старт

## Вариант 1: Docker (Рекомендуется!) ⭐

```bash
# Одна команда - и всё работает!
docker-compose up --build
```

**Приложение доступно:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Остановить:**
```bash
docker-compose down
```

📖 **Подробная инструкция:** [DOCKER.md](DOCKER.md)

---

## Вариант 2: Ручная установка

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
python -m app.seed_data_fixed
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

📖 **Подробная инструкция:** [README.md](README.md)

---

## Тестовые учетные данные

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | `admin@dental-lab.ru` | `Admin123!` |
| Manager | `manager1@dental-lab.ru` | `Manager123!` |
| Technician | `technician1@dental-lab.ru` | `Tech123!` |
| Client | `client1@dental-lab.ru` | `Client123!` |

---

## Полезные команды

### Docker

```bash
docker-compose logs -f           # Логи
docker-compose exec backend bash # Shell в контейнере
docker-compose down -v           # Очистка данных
```

### Backend

```bash
python -m app.seed_data_fixed    # Тестовые данные
alembic upgrade head             # Миграции
```

### Frontend

```bash
npm run build                    # Сборка
npm run dev                      # Dev сервер
```
