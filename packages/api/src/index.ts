/**
 * Hono API entry point (resolves issue #2)
 *
 * Global middleware: CORS, request logger, error handler
 * Health check: GET /health
 * Routes: /bounties
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/index.js";
import { createBountyRoutes } from "./routes/bounties.js";

const app = new Hono();

// ── Global middleware ─────────────────────────────────────────────────────
app.use("*", cors());
app.use("*", logger());

// ── Health check ──────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// ── Routes ────────────────────────────────────────────────────────────────
app.route("/bounties", createBountyRoutes(db));

// ── Global error handler ─────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: "Internal server error", code: "INTERNAL_ERROR", statusCode: 500 },
    500
  );
});

export default app;
