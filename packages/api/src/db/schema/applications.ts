/**
 * Applications table schema (resolves issue #9)
 *
 * Fields: id, bounty_id, applicant_id, cover_letter, estimated_time,
 *         experience_links (jsonb), status enum (pending/accepted/rejected),
 *         created_at
 * Constraint: unique(bounty_id, applicant_id)
 */
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { bounties } from "./bounties.js";
import { users } from "./users.js";

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bountyId: uuid("bounty_id")
      .notNull()
      .references(() => bounties.id, { onDelete: "cascade" }),
    applicantId: uuid("applicant_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    coverLetter: text("cover_letter"),
    estimatedTime: text("estimated_time"),
    experienceLinks: jsonb("experience_links").$type<string[]>().default([]),
    status: applicationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("uq_application_bounty_applicant").on(table.bountyId, table.applicantId)]
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
