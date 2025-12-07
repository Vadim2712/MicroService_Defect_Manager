# Microservice Defect Manager

Это учебный проект, демонстрирующий создание микросервисной архитектуры с использованием Node.js, Express, PostgreSQL и Docker в соответствии с предоставленным техническим заданием.

## Архитектура

Проект состоит из трех основных компонентов, работающих в Docker-контейнерах:

*   `api_gateway`: Единая точка входа, отвечающая за маршрутизацию, аутентификацию и безопасность.
*   `service_users`: Сервис для управления пользователями (регистрация, вход, профиль).
*   `service_orders`: Сервис для управления заказами.

Дополнительные контейнеры:
*   `postgres`: База данных PostgreSQL.
*   `jaeger`: Система для сбора и визуализации трассировок (OpenTelemetry).
*   `adminer`: Веб-интерфейс для управления базой данных.

## 1. Необходимые условия

Для запуска и работы с проектом вам понадобятся:
*   **Node.js** (версия 18 или выше)
*   **Docker** и **Docker Compose**

## 2. Настройка окружения

### Создание файла `.env`
Перед первым запуском необходимо настроить переменные окружения. Для этого создайте файл с именем `.env` в корневой папке проекта.

**Важно:** Этот шаг обязателен для корректной работы.

Скопируйте в созданный файл `.env` следующее содержимое и при необходимости измените значения. Пароль и секретный ключ рекомендуется сменить на более надежные.

```env
# Port for the API Gateway
PORT=8000

# JWT secret key for signing tokens
JWT_SECRET=your_super_secret_and_long_key_for_jwt

# Database connection settings
# Note: DB_NAME is now set in docker-compose.yml, but is used by tests.
DB_USER=user
DB_PASSWORD=password
DB_HOST=postgres
DB_NAME=servicedb
DB_PORT=5432

# URLs for inter-service communication (used by the gateway)
USERS_SERVICE_URL=http://service_users:8001
ORDERS_SERVICE_URL=http://service_orders:8002

# Jaeger endpoint for OpenTelemetry
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## 3. Запуск проекта

Для сборки образов и запуска всех сервисов выполните одну команду в корне проекта:

```bash
docker-compose up --build
```
Эта команда запустит все контейнеры в фоновом режиме (`-d` можно добавить для запуска в фоне).

После успешного запуска будут доступны следующие эндпоинты:
*   **API Gateway**: `http://localhost:8000/api-docs`
*   **Jaeger UI** (для просмотра трасс): `http://localhost:16686`
*   **Adminer** (для просмотра БД): `http://localhost:8080` (Система: `PostgreSQL`, Сервер: `postgres`, Пользователь: `user`, Пароль: `password`, База данных: `servicedb`)

## 4. Запуск тестов

Тесты для сервисов `users` и `orders` различаются по своей природе.

### Service Users (Модульные тесты)
Эти тесты не требуют подключения к базе данных, так как она имитируется (мокается).

```bash
# 1. Перейдите в директорию сервиса
cd service_users

# 2. Установите зависимости (если еще не сделали)
npm install

# 3. Запустите тесты
npm test
```

### Service Orders (Интеграционные тесты)
Эти тесты требуют **запущенного Docker-контейнера с базой данных**.

```bash
# 1. Убедитесь, что контейнер с БД запущен.
# В корне проекта выполните:
docker-compose up -d postgres

# 2. Перейдите в директорию сервиса
cd service_orders

# 3. Установите зависимости (если еще не сделали)
npm install

# 4. Запустите тесты
npm test
```

## 5. Остановка проекта

Чтобы остановить все запущенные контейнеры и удалить созданную Docker-сеть, выполните:

```bash
docker-compose down
```
