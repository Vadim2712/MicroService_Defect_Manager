# Microservice Defect Manager

This is a microservices-based application for managing defects, built with Node.js, Express, and PostgreSQL. The entire application is containerized using Docker.

## Technologies

*   **Backend:** Node.js, Express.js
*   **Database:** PostgreSQL
*   **Containerization:** Docker, Docker Compose
*   **API Gateway:** Custom-built with `http-proxy-middleware`
*   **Authentication:** JWT (JSON Web Tokens)
*   **Validation:** Zod
*   **Logging:** Pino (with `pino-http`)

## Architecture

The application follows a microservice architecture:

*   **`api_gateway`:** The single entry point for all client requests. It handles routing, authentication, rate limiting, and CORS. It forwards requests to the appropriate downstream service.
*   **`service_users`:** Manages all user-related operations, including registration, login, profile management, and admin-level user listing.
*   **`service_orders`:** Manages all order-related operations, such as creation, retrieval, status updates, and cancellation.
*   **`postgres`:** The central database for both services.
*   **`initdb/init.sql`**: The single source of truth for the database schema.

## Getting Started

To get started with this project, you need to have Docker and Docker Compose installed on your machine.

## Building and Running

1.  **Environment Variables:**

    This project uses environment-specific `.env` files. You will need to create `.env.development` and `.env.production` files. You can start by copying the `.env.example` file:

    ```bash
    cp .env.example .env.development
    cp .env.example .env.production
    ```

    (Fill in the `.env` files with your settings).

2.  **Running the Application:**

    To run the application in a development environment, use:

    ```bash
    NODE_ENV=development docker-compose up --build -d
    ```

    To run the application in a production environment, use:

    ```bash
    NODE_ENV=production docker-compose up --build -d
    ```

3.  **Stopping the Application:**

    ```bash
    docker-compose down
    ```

## API Endpoints

The API is versioned under `/api/v1`.

### Auth (via `service_users`)

*   `POST /auth/register`: Register a new user.
*   `POST /auth/login`: Log in a user and get a JWT.

### Users (via `service_users`)

*   `GET /users/profile`: Get the current user's profile.
*   `PUT /users/profile`: Update the current user's profile.

### Admin (via `service_users`)

*   `GET /admin/users`: List all users (admin only).
*   `GET /admin/users/:id`: Get user by ID (admin only).
*   `PUT /admin/users/:id`: Update user by ID (admin only).

### Orders (via `service_orders`)

*   `POST /orders`: Create a new order.
*   `GET /orders`: Get a list of the current user's orders.
*   `GET /orders/:id`: Get an order by its ID.
*   `PATCH /orders/:id/status`: Update status (admin only).
*   `PATCH /orders/:id/cancel`: Cancel an order (owner only).
