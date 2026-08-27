# Kanri API

> Production-style task management REST API built with **TypeScript, Node.js, Express, PostgreSQL, and Prisma**.

**🏆 1st Place at Final Project Defense**  
Team project developed by a seven-person team. I contributed as a **Backend Developer**.

## Highlights

- JWT access-token authentication with refresh-token rotation
- Protected routes and revoked-token handling
- PostgreSQL database with Prisma ORM, migrations, and seed data
- Task CRUD with filtering, permissions, assignment limits, and workflow rules
- OpenAPI documentation
- Docker development and production setups
- GitHub Actions CI
- Unit and database integration tests
- ESLint, Prettier, TypeScript checks, and Husky hooks

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT + refresh tokens
- **DevOps:** Docker, Docker Compose, GitHub Actions
- **Quality:** ESLint, Prettier, Husky, automated tests

## Core API

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/me`

### Tasks

- `POST /tasks`
- `GET /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`

Task listing supports optional `status` and `assignee` filters.

## Business Rules

The API includes backend rules beyond basic CRUD:

- an assignee can have at most 3 active tasks
- tasks cannot be created directly in `Done`
- a task can move to `Done` only from `Review`
- task deletion is restricted by workspace permissions / task ownership

## Local Setup

```bash
cp .env.example .env
npm install
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Apply migrations, seed defaults, and run the API:

```bash
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

Health check:

```text
GET /health
```

## Environment Variables

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_SECONDS`
- `CORS_ORIGIN`

## API Documentation

OpenAPI JSON:

```text
GET /openapi.json
```

Human-readable docs:

```text
GET /docs
```

## Docker

Development database:

```bash
npm run docker:dev
```

Production-style API + PostgreSQL stack:

```bash
JWT_SECRET="replace-with-a-real-secret" npm run docker:prod
```

## CI & Quality

The GitHub Actions workflow runs:

- dependency installation
- Prisma client generation
- database migrations and seed
- lint and formatting checks
- TypeScript build
- unit tests
- database integration tests
- Docker image build

Run local quality checks with:

```bash
npm run check
```

---

### Why this project matters

Kanri demonstrates practical backend work with authentication, relational data, business rules, API documentation, automated checks, containerization, and team development—not just basic CRUD endpoints.
