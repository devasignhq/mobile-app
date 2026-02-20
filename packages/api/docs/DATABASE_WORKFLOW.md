# Database Workflow

This document outlines the database management workflow using Drizzle Kit.

## Setup

Ensure you have your environment variables configured in the root `.env` file. The scripts will automatically compose `DATABASE_URL` if it's missing but `POSTGRES_*` variables are present.

## Commands

All commands should be run from the `packages/api` directory.

### Generate Migrations
Generate SQL migration files based on changes in `src/db/schema.ts`.
```bash
npm run db:generate
```

### Apply Migrations
Apply pending migrations to the database.
```bash
npm run db:migrate
```

### Drizzle Studio
Explore the database visually.
```bash
npm run db:studio
```

### Seed Database
Populate the database with initial or test data.
```bash
npm run db:seed
```

## Workflow Example

1. **Modify Schema**: Update `src/db/schema.ts`.
2. **Generate Migration**: Run `npm run db:generate`.
3. **Review**: Check the generated SQL file in the `drizzle/` directory.
4. **Deploy**: Run `npm run db:migrate` to update your database.
