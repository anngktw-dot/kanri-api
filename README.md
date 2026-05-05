# Kanri API

Express + Prisma API with PostgreSQL schema, migrations, seed data, and a health endpoint.

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

## Environment

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - secret for future JWT auth
- `PORT` - HTTP server port

## Quality checks

```bash
npm run check
```
