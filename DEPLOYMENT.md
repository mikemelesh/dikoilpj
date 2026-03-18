# Инструкция по развёртыванию Dental Lab на другой системе

## Требования

- **Python 3.10+**
- **PostgreSQL 14+**
- **Node.js 18+**
- **npm 9+**

---

## Шаг 1: Подготовка базы данных

### 1.1. Установите PostgreSQL

**Windows:**
- Скачайте с https://www.postgresql.org/download/windows/
- Установите, запомните пароль пользователя `postgres`

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 1.2. Создайте базу данных

```bash
# Войдите в PostgreSQL
psql -U postgres

# Создайте базу данных
CREATE DATABASE dental_lab;

# Создайте пользователя (опционально)
CREATE USER dental_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dental_lab TO dental_user;

# Выйдите
\q
```

---

## Шаг 2: Настройка Backend

### 2.1. Скопируйте файлы проекта

```bash
# Скопируйте папку backend на новую систему
# Например, через git clone или архив
git clone <your-repo-url>
cd dikoilpj/backend
```

### 2.2. Создайте виртуальное окружение

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2.3. Установите зависимости

```bash
pip install -r requirements.txt
```

### 2.4. Настройте переменные окружения

Создайте файл `.env` в папке `backend`:

```bash
# Backend Environment Variables
PROJECT_NAME=Dental Lab API

# Security - ГЕНЕРИРУЙТЕ НОВЫЙ КЛЮЧ ДЛЯ ПРОДАКШЕНА!
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Database
SQLALCHEMY_DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/dental_lab

# CORS Origins
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://your-domain.com

# Upload Directory
UPLOAD_DIR=../uploads

# Rate Limiting
RATE_LIMIT_DEFAULT=100
RATE_LIMIT_AUTH=5
```

**Важно:**
- Замените `YOUR_PASSWORD` на пароль от PostgreSQL
- Для продакшена сгенерируйте новый `SECRET_KEY`:
  ```python
  import secrets
  print(secrets.token_urlsafe(32))
  ```
- Обновите `CORS_ORIGINS` для вашего домена

### 2.5. Примените миграции

```bash
alembic upgrade head
```

### 2.6. Создайте администратора (опционально)

```bash
python -m app.create_admin
```

### 2.7. Заполните тестовыми данными (опционально)

```bash
python -m app.seed_data
```

### 2.8. Запустите backend

**Development:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Backend доступен на: `http://localhost:8000`
Документация API: `http://localhost:8000/docs`

---

## Шаг 3: Настройка Frontend

### 3.1. Перейдите в папку frontend

```bash
cd ../frontend
```

### 3.2. Установите зависимости

```bash
npm install
```

### 3.3. Настройте переменные окружения

Создайте файл `.env` в папке `frontend`:

```bash
# Frontend Environment Variables
VITE_API_URL=http://localhost:8000/api
```

**Для продакшена:**
```bash
VITE_API_URL=https://your-api-domain.com/api
```

### 3.4. Запустите frontend

**Development:**
```bash
npm run dev
```

Frontend доступен на: `http://localhost:5173`

**Production build:**
```bash
npm run build
```

Собранные файлы будут в папке `dist/`.

---

## Шаг 4: Настройка веб-сервера (Production)

### 4.1. Nginx конфигурация

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Upload files
    location /uploads {
        alias /path/to/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.2. HTTPS (SSL/TLS)

```bash
# Установите Certbot
sudo apt install certbot python3-certbot-nginx

# Получите сертификат
sudo certbot --nginx -d your-domain.com
```

---

## Шаг 5: Запуск в production

### 5.1. Systemd сервисы (Linux)

**Backend сервис (`/etc/systemd/system/dental-lab-backend.service`):**
```ini
[Unit]
Description=Dental Lab Backend API
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

**Frontend сервис (опционально):**
```bash
# Или используйте nginx для раздачи статических файлов
```

### 5.2. Запуск сервисов

```bash
# Перезагрузите systemd
sudo systemctl daemon-reload

# Включите автозапуск
sudo systemctl enable dental-lab-backend

# Запустите
sudo systemctl start dental-lab-backend

# Проверьте статус
sudo systemctl status dental-lab-backend
```

---

## Шаг 6: Резервное копирование

### 6.1. База данных

```bash
# Создать дамп
pg_dump -U postgres dental_lab > backup_$(date +%Y%m%d).sql

# Восстановить
psql -U postgres dental_lab < backup_20260318.sql
```

### 6.2. Файлы

```bash
# Резервное копирование загрузок
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ../uploads/
```

---

## Тестовые учётные данные

После запуска `seed_data`:

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | `admin@dental-lab.ru` | `Admin123!` |
| Manager | `manager1@dental-lab.ru` | `Manager123!` |
| Technician | `technician1@dental-lab.ru` | `Tech123!` |
| Client | `client1@dental-lab.ru` | `Client123!` |

---

## Проверка работы

1. Откройте `http://your-domain.com`
2. Войдите как `admin@dental-lab.ru` / `Admin123!`
3. Проверьте все разделы:
   - Заказы
   - Клиенты
   - Техники
   - Услуги
   - Материалы

---

## Устранение проблем

### Backend не запускается

```bash
# Проверьте логи
journalctl -u dental-lab-backend -f

# Проверьте подключение к БД
psql -U postgres -d dental_lab -c "SELECT 1"
```

### Frontend не подключается к API

1. Проверьте `VITE_API_URL` в `.env`
2. Убедитесь, что backend запущен
3. Проверьте CORS настройки в backend `.env`

### Ошибки миграций

```bash
# Сбросьте миграции (ОСТОРОЖНО: удалит все данные!)
alembic downgrade base
alembic upgrade head
```

---

## Контакты и поддержка

При возникновении проблем проверьте:
- Логи backend: `journalctl -u dental-lab-backend`
- Логи frontend: консоль браузера (F12)
- Логи PostgreSQL: `/var/log/postgresql/`
