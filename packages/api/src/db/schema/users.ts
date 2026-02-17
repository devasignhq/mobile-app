/**
 * Users table schema (resolves issue #7)
 *
 * Fields: id (uuid), github_id (bigint, unique), username, avatar_url, email,
 *         tech_stack (jsonb), wallet_address, wallet_secret_enc,
 *         total_earned, bounties_completed, created_at
 */
import {
  pgTable,
  uuid,
  bigint,
  varchar,
  text,
  jsonb,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url").notNull(),
  email: varchar("email", { length: 255 }),
  techStack: jsonb("tech_stack").$type<string[]>().default([]),
  walletAddress: text("wallet_address"),
  walletSecretEnc: text("wallet_secret_enc"),
  totalEarned: numeric("total_earned", { precision: 18, scale: 6 }).notNull().default("0"),
  bountiesCompleted: integer("bounties_completed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
