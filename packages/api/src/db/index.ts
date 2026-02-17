/**
 * Neon serverless PostgreSQL connection (resolves issue #6)
 *
 * Uses connection pooling via neon() http driver for serverless environments.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/index.js";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export type Database = typeof db;
