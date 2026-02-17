/**
 * Bounties table schema (resolves issue #8)
 *
 * Fields: id, github_issue_id, repo_owner, repo_name, title, description,
 *         amount_usdc, tech_tags (jsonb), difficulty enum,
 *         status enum (open/assigned/in_review/completed/cancelled),
 *         deadline, creator_id, assignee_id
 */
import {
  pgTable,
  uuid,
  bigint,
  varchar,
  text,
  jsonb,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const difficultyEnum = pgEnum("difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const bountyStatusEnum = pgEnum("bounty_status", [
  "open",
  "assigned",
  "in_review",
  "completed",
  "cancelled",
]);

export const bounties = pgTable("bounties", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubIssueId: bigint("github_issue_id", { mode: "number" }).notNull(),
  repoOwner: varchar("repo_owner", { length: 255 }).notNull(),
  repoName: varchar("repo_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  amountUsdc: numeric("amount_usdc", { precision: 18, scale: 6 }).notNull(),
  techTags: jsonb("tech_tags").$type<string[]>().default([]),
  difficulty: difficultyEnum("difficulty").notNull(),
  status: bountyStatusEnum("status").notNull().default("open"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Bounty = typeof bounties.$inferSelect;
export type NewBounty = typeof bounties.$inferInsert;
