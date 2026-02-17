# @devasign/api

Hono-based REST API for the DevAsign bounty marketplace.

## Stack

- [Hono](https://hono.dev/) — lightweight TypeScript web framework
- [Drizzle ORM](https://orm.drizzle.team/) — type-safe ORM
- [Neon](https://neon.tech/) — serverless PostgreSQL
- [Vitest](https://vitest.dev/) — test runner

## Getting started

```bash
cp .env.example .env
# set DATABASE_URL in .env

npm install
npm run dev
```

## Testing

```bash
npm test
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/bounties/:id` | Full bounty detail (issue #21) |

## Database

Generate migrations from the Drizzle schema:

```bash
npm run db:generate
npm run db:migrate
```
