import { pgTable, text, timestamp, varchar, bigint, jsonb, decimal, integer, uuid, pgEnum } from 'drizzle-orm/pg-core';

export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const statusEnum = pgEnum('status', ['open', 'assigned', 'in_review', 'completed', 'cancelled']);

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    githubId: bigint('github_id', { mode: 'bigint' }).unique(),
    username: text('username'),
    avatarUrl: text('avatar_url'),
    email: varchar('email', { length: 256 }).notNull().unique(),
    techStack: jsonb('tech_stack').$type<string[]>(),
    walletAddress: text('wallet_address'),
    walletSecretEnc: text('wallet_secret_enc'),
    totalEarned: decimal('total_earned', { precision: 20, scale: 7 }).default('0').notNull(),
    bountiesCompleted: integer('bounties_completed').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow(), // Note: DB trigger `update_users_updated_at` handles updates
});

export const bounties = pgTable('bounties', {
    id: uuid('id').primaryKey().defaultRandom(),
    githubIssueId: integer('github_issue_id'),
    repoOwner: text('repo_owner').notNull(),
    repoName: text('repo_name').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    amountUsdc: decimal('amount_usdc', { precision: 20, scale: 7 }).default('0').notNull(),
    techTags: jsonb('tech_tags').$type<string[]>().default([]).notNull(),
    difficulty: difficultyEnum('difficulty').notNull(),
    status: statusEnum('status').default('open').notNull(),
    deadline: timestamp('deadline'),
    creatorId: uuid('creator_id').references(() => users.id).notNull(),
    assigneeId: uuid('assignee_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

