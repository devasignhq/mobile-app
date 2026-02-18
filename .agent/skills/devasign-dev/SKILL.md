---
name: devasign-dev
description: Development tasks for the Devasign mobile app and API monorepo.
---

# Devasign Monorepo Skills

This skill helps with common development tasks for the Devasign project, which is a monorepo containing a mobile app (Vite/React) and an API (Hono).

## Project Structure

- **root**: Contains workspace configuration and shared scripts.
- **packages/mobile**: The frontend application built with Vite and React.
- **packages/api**: The backend API built with Hono.

## Common Tasks

### 1. Start Development Servers

To start both the mobile app and the API concurrently:

```bash
npm run dev
```
(This runs `pnpm -r dev`)

To start valid individual parts:

**Mobile App only:**
```bash
cd packages/mobile
npm run dev
```

**API only:**
```bash
cd packages/api
npm run dev
```

### 2. Build the Project

To build all packages:

```bash
npm run build
```

To build individual packages, navigate to the package directory and run `npm run build`.

### 3. Linting and Formatting

To lint all packages:

```bash
npm run lint
```

### 4. Type Checking

To run TypeScript type checks across the monorepo:

```bash
npm run typecheck
```

## Dependencies

This project uses `pnpm` for package management.

- Install dependencies: `pnpm install`
