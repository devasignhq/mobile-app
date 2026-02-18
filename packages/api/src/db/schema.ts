import { pgTable, text, timestamp, varchar, bigint, jsonb, decimal, integer, uuid } from 'drizzle-orm/pg-core';

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

