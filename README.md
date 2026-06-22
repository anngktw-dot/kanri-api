# Kanri API

Production-style Express + Prisma API with PostgreSQL schema, migrations, seed data, JWT auth, refresh tokens, protected routes, and a health endpoint.

## Setup

Install dependencies and create a local environment file:

```bash
cp .env.example .env
npm install
```

Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

Or use an already installed local PostgreSQL instance with the connection string from `.env`:

```bash
createdb kanri
```

Apply migrations, seed defaults, and start the API:

```bash
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The seed creates default task statuses and a demo user:

```text
email: admin@example.com
password: ChangeMe123
```

Root endpoint:

```bash
curl http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/health
```

Successful response:

```json
{
  "status": "ok",
  "database": "ok",
  "uptime": 12.34,
  "timestamp": "2026-05-06T10:00:00.000Z"
}
```

Register:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"ChangeMe123","name":"User"}'
```

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"ChangeMe123"}'
```

Refresh access token:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refresh-token>"}'
```

Current user:

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer <access-token>"
```

Create a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <access-token>" \
  -d '{"title":"Prepare release notes","assignee":"admin@example.com","description":"Draft and review notes","priority":"high"}'
```

List tasks, optionally filtered by `status` or `assignee`:

```bash
curl "http://localhost:3000/tasks?status=To%20Do&assignee=admin@example.com" \
  -H "Authorization: Bearer <access-token>"
```

Update a task:

```bash
curl -X PATCH http://localhost:3000/tasks/<task-id> \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <access-token>" \
  -d '{"status":"Review","deadline":"2026-05-20T12:00:00.000Z"}'
```

Delete a task:

```bash
curl -X DELETE http://localhost:3000/tasks/<task-id> \
  -H "Authorization: Bearer <access-token>"
```

Logout invalidates the current access token until it expires:

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer <access-token>" \
  -d '{"refreshToken":"<refresh-token>"}'
```

## Environment

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - secret for JWT auth
- `PORT` - HTTP server port
- `ACCESS_TOKEN_TTL_SECONDS` - JWT access token TTL, defaults to `900`
- `REFRESH_TOKEN_TTL_SECONDS` - refresh token TTL, defaults to `604800`
- `CORS_ORIGIN` - allowed CORS origin, defaults to `*`

## API Documentation

OpenAPI JSON is available from the running server:

```bash
curl http://localhost:3000/openapi.json
```

Human-readable docs landing page:

```bash
open http://localhost:3000/docs
```

You can import this document into Swagger UI, Postman, Insomnia, or any OpenAPI-compatible client.

## Auth

- `POST /auth/register` validates email and password, stores a `scrypt` password hash, and returns access and refresh tokens.
- `POST /auth/login` validates email and password, compares the stored `scrypt` password hash, and returns access and refresh tokens.
- `POST /auth/refresh` rotates the refresh token and returns a new access token.
- `POST /auth/logout` is protected by the JWT guard and persists the revoked access token in `revoked_tokens`; when a refresh token is provided, it is revoked too.
- `GET /users/me` is protected by the JWT guard and returns the current user.
- Private routes return `401` when the bearer token is missing, invalid, expired, or revoked.

Access tokens are signed with HS256 and include `sub`, `email`, `iat`, `exp`, and `jti` claims. The current access token TTL is 15 minutes. Refresh tokens are opaque random tokens stored as SHA-256 hashes and rotated on every refresh.

Login and registration routes include a small IP-based rate limiter to reduce brute-force attempts.

## Tasks

- `POST /tasks` creates a task with `To Do` status, validates required `title` and `assignee`, and returns the created task for frontend use without a reload.
- `GET /tasks` returns all tasks, with optional `status` and `assignee` filters.
- `GET /tasks/:id` returns task details: title, description, status, assignee, deadline, and priority.
- `PATCH /tasks/:id` updates title, description, status, assignee, deadline, or priority and returns the updated task.
- `DELETE /tasks/:id` deletes the task only when the current user is a workspace administrator or the task author.
- An assignee can have at most 3 active tasks. Active means every status except `Done`.
- A task cannot be created as `Done`, and it cannot move to `Done` unless its current status is `Review`.

## Database

Core tables:

- `users`
- `workspaces`
- `workspace_members`
- `tasks`
- `statuses`
- `transition_rules`
- `comments`
- `notifications`
- `revoked_tokens`
- `refresh_tokens`

## Docker

Development database only:

```bash
npm run docker:dev
```

Production-style API + PostgreSQL stack:

```bash
JWT_SECRET="replace-with-a-real-secret" npm run docker:prod
```

The production compose file builds the API image, waits for PostgreSQL health checks, applies Prisma migrations, and starts the server.

## CI

GitHub Actions workflow is included at `.github/workflows/ci.yml`. It runs:

- dependency install with `npm ci`
- Prisma client generation
- database migrations
- seed script
- lint, formatting, TypeScript build, and unit tests
- database integration tests
- Docker image build

## Quality checks

```bash
npm run check
```

`npm run check` runs linting, formatting checks, TypeScript build, and fast unit tests.

Database integration tests require PostgreSQL from `.env`:

```bash
npm run test:integration
```

# kanri-api
