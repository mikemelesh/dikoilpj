# Бесплатный деплой Dental Lab

## Варианты бесплатного хостинга

### 1. **Render.com** (Рекомендуется)

**Преимущества:**
- Бесплатный хостинг backend и frontend
- Автоматический деплой из GitHub
- PostgreSQL база данных (бесплатно 90 дней, потом $7/мес)
- SSL сертификат включён

**Ограничения:**
- Backend "засыпает" через 15 минут бездействия (первый запрос долгий)
- 512 MB RAM
- 0.1 CPU

**Инструкция:**

#### Backend на Render:

1. Зарегистрируйтесь на https://render.com
2. Создайте новый Web Service
3. Подключите GitHub репозиторий
4. Настройки:
   - **Name:** dental-lab-api
   - **Region:** Frankfurt (ближе к Европе)
   - **Branch:** main
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. Environment Variables:
   ```
   SECRET_KEY=your-secret-key
   SQLALCHEMY_DATABASE_URL=postgresql://user:pass@host:5432/dental_lab
   CORS_ORIGINS=https://your-frontend.onrender.com
   UPLOAD_DIR=/tmp/uploads
   ```

6. Создайте PostgreSQL базу в Render Dashboard

#### Frontend на Render:

1. Создайте новый Static Site
2. Подключите репозиторий
3. Настройки:
   - **Name:** dental-lab-frontend
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. Environment Variables:
   ```
   VITE_API_URL=https://dental-lab-api.onrender.com/api
   ```

---

### 2. **Railway.app**

**Преимущества:**
- $5 кредитов в месяц бесплатно
- Не "засыпает"
- PostgreSQL включён
- Простой деплой

**Ограничения:**
- Кредиты заканчиваются быстро при активном использовании

**Инструкция:**

1. Зарегистрируйтесь на https://railway.app
2. Создайте новый проект
3. Deploy from GitHub repo
4. Добавьте PostgreSQL базу
5. Environment Variables для backend:
   ```
   SECRET_KEY=your-key
   SQLALCHEMY_DATABASE_URL=${{Postgres.DATABASE_URL }}
   CORS_ORIGINS=https://your-frontend.railway.app
   ```

---

### 3. **Vercel + Supabase** (Frontend + Backend + DB)

**Преимущества:**
- Frontend на Vercel (полностью бесплатно)
- Backend как Serverless Functions
- Supabase PostgreSQL (бесплатно 500MB)

**Ограничения:**
- Нужно адаптировать backend под serverless
- Ограничения serverless функций (10 сек выполнение)

**Инструкция:**

#### Frontend на Vercel:

```bash
# Установите Vercel CLI
npm i -g vercel

# В папке frontend
cd frontend
vercel login
vercel --prod
```

Environment Variables в Vercel Dashboard:
```
VITE_API_URL=https://your-api.vercel.app/api
```

#### Backend как Vercel Functions:

1. Создайте `api/` папку в корне
2. Переместите backend код
3. Создайте `vercel.json`:
   ```json
   {
     "functions": {
       "api/app/main.py": {
         "runtime": "vercel-python@3.0"
       }
     },
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/app/main.py"
       }
     ]
   }
   ```

#### Supabase База:

1. Зарегистрируйтесь на https://supabase.com
2. Создайте проект
3. Получите connection string
4. Запустите миграции через SQL Editor

---

### 4. **Fly.io**

**Преимущества:**
- 3 бесплатных VM (256MB RAM каждая)
- PostgreSQL включён
- Не "засыпает"

**Ограничения:**
- Требуется кредитная карта для регистрации
- Сложнее в настройке

**Инструкция:**

```bash
# Установите flyctl
curl -L https://fly.io/sh/install.sh | sh

# Авторизуйтесь
fly auth login

# Создайте приложение
fly launch --name dental-lab

# Добавьте PostgreSQL
fly pg create --name dental-db

# Прилинкуйте базу
fly pg attach dental-db

# Деплой
fly deploy
```

---

### 5. **Hugging Face Spaces** (Frontend)

**Преимущества:**
- Полностью бесплатно
- Неограниченное время
- Простой деплой

**Ограничения:**
- Только статический frontend
- Backend нужен отдельно

**Инструкция:**

1. Создайте Space на https://huggingface.co/spaces
2. Выберите "Static" тип
3. Загрузите файлы из `dist/` папки
4. В `README.md` укажите:
   ```markdown
   ---
   title: Dental Lab
   emoji: 🦷
   colorFrom: blue
   colorTo: purple
   sdk: static
   pinned: false
   ---
   ```

---

## Быстрый старт (Render.com)

### 1. Подготовка

```bash
# Инициализируйте git
git init
git add .
git commit -m "Initial commit"

# Запушьте на GitHub
git remote add origin https://github.com/your-username/dental-lab.git
git push -u origin main
```

### 2. Backend

1. https://render.com → New Web Service
2. Connect repository
3. Configure:
   - Name: `dental-lab-api`
   - Root Directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Add Environment Variables:
   ```
   SECRET_KEY=change-this-to-random-string
   SQLALCHEMY_DATABASE_URL=postgresql://user:password@host:5432/dental_lab
   CORS_ORIGINS=*
   UPLOAD_DIR=/tmp/uploads
   ```

5. Create Database:
   - Render Dashboard → New → PostgreSQL
   - Copy internal connection URL
   - Update `SQLALCHEMY_DATABASE_URL`

6. Run migrations:
   ```bash
   # В Render Shell
   cd backend
   alembic upgrade head
   python -m app.seed_data
   ```

### 3. Frontend

1. https://render.com → New Static Site
2. Connect repository
3. Configure:
   - Name: `dental-lab`
   - Root Directory: `frontend`
   - Build: `npm install && npm run build`
   - Publish: `dist`

4. Environment Variables:
   ```
   VITE_API_URL=https://dental-lab-api.onrender.com/api
   ```

### 4. Проверка

1. Откройте `https://dental-lab.onrender.com`
2. Войдите как `admin@dental-lab.ru` / `Admin123!`
3. Проверьте все разделы

---

## Советы для оптимизации

### 1. **Уменьшите размер сборки**

```bash
# В frontend/vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog']
        }
      }
    }
  }
}
```

### 2. **Кэширование**

```python
# В backend добавьте кэширование
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend(), prefix="fastapi-cache")
```

### 3. **Сжатие файлов**

```bash
# Установите gzip
npm install -g gzip-size

# Проверьте размер
gzip-size dist/assets/*.js
```

---

## Мониторинг

### Render Dashboard:
- Логи в реальном времени
- Метрики использования CPU/RAM
- Автоматические деплои из Git

### Uptime Robot (бесплатно):
- https://uptimerobot.com
- Мониторинг каждые 5 минут
- Email уведомления при downtime

---

## Продление бесплатного периода

### Render PostgreSQL (90 дней):

1. Создайте новую базу перед окончанием периода
2. Сделайте дамп старой:
   ```bash
   pg_dump -U user old_db > backup.sql
   ```
3. Восстановите на новую:
   ```bash
   psql -U user new_db < backup.sql
   ```
4. Обновите `SQLALCHEMY_DATABASE_URL`

### Альтернатива: Neon.tech

- Бесплатно навсегда
- Serverless PostgreSQL
- https://neon.tech

```bash
# Получите connection string из Neon Dashboard
# Обновите в Render Environment Variables
SQLALCHEMY_DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dental_lab
```

---

## Troubleshooting

### Backend не запускается:

```bash
# Проверьте логи в Render Dashboard
# Проверьте Environment Variables
# Убедитесь что миграции применены
alembic current
```

### Frontend не подключается:

```bash
# Проверьте VITE_API_URL
# Проверьте CORS настройки backend
# Откройте консоль браузера (F12)
```

### База данных не доступна:

```bash
# Проверьте connection string
# Убедитесь что IP разрешён в настройках PostgreSQL
# Для Render: используйте Internal Database URL
```

---

## Ссылки

- Render: https://render.com
- Railway: https://railway.app
- Vercel: https://vercel.com
- Supabase: https://supabase.com
- Fly.io: https://fly.io
- Hugging Face: https://huggingface.co/spaces
- Neon: https://neon.tech
- Uptime Robot: https://uptimerobot.com
