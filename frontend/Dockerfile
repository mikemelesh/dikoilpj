# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files
COPY package*.json ./

# Собираем с VITE_API_URL из build-arg (для production deploy)
ARG VITE_API_URL=http://localhost:8000/api
ENV VITE_API_URL=$VITE_API_URL

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
