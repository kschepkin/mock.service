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

# Production образ с nginx
FROM nginx:alpine

# Копирование собранного приложения
COPY --from=build /app/dist /usr/share/nginx/html

# Копирование конфигурации nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 