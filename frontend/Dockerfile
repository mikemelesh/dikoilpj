# Frontend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production стадия
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем nginx конфиг (опционально)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Порт frontend
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
