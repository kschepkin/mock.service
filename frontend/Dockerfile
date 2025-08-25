FROM node:18-alpine as build

WORKDIR /app

# Копирование файлов зависимостей
COPY package*.json ./

# Установка зависимостей с legacy peer deps для совместимости
RUN npm install --progress-bar off --legacy-peer-deps

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Production образ с openresty (nginx + lua)
FROM openresty/openresty:alpine

# Установка дополнительных пакетов
RUN apk add --no-cache curl

# Копирование собранного приложения
COPY --from=build /app/dist /usr/local/openresty/nginx/html

# Создание директории для конфигурации
RUN mkdir -p /usr/local/openresty/nginx/html/config && \
    chmod 777 /usr/local/openresty/nginx/html/config

# Копирование конфигурации nginx  
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Копирование lua скрипта
COPY write-config.lua /usr/local/openresty/nginx/write-config.lua

# Создание директории и символической ссылки для совместимости
RUN mkdir -p /usr/share/nginx && \
    ln -sf /usr/local/openresty/nginx/html /usr/share/nginx/html

EXPOSE 80

CMD ["openresty", "-g", "daemon off;"] 