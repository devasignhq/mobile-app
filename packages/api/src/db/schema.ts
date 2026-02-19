import { pgTable, text, timestamp, varchar, bigint, jsonb, decimal, integer, uuid, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const difficultyEnum = pgEnum('difficulty', ['beginner', 'intermediate', 'advanced']);
export const statusEnum = pgEnum('status', ['open', 'assigned', 'in_review', 'completed', 'cancelled']);
export const applicationStatusEnum = pgEnum('application_status', ['pending', 'accepted', 'rejected']);
export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'approved', 'rejected', 'disputed']);
export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'resolved', 'dismissed']);

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
    githubIssueId: bigint('github_issue_id', { mode: 'number' }),
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
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow(), // Note: DB trigger `update_bounties_updated_at` handles updates
}, (table) => {
    return {
        creatorIdx: index('bounties_creator_id_idx').on(table.creatorId),
        assigneeIdx: index('bounties_assignee_id_idx').on(table.assigneeId),
        statusIdx: index('bounties_status_idx').on(table.status),
        githubIssueIdKey: uniqueIndex('bounties_github_issue_id_key').on(table.githubIssueId),
    };
});

export const applications = pgTable('applications', {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id').references(() => bounties.id, { onDelete: 'cascade' }).notNull(),
    applicantId: uuid('applicant_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    coverLetter: text('cover_letter').notNull(),
    estimatedTime: integer('estimated_time').notNull(),
    experienceLinks: jsonb('experience_links').$type<string[]>().default([]).notNull(),
    status: applicationStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
    return {
        bountyApplicantUnique: uniqueIndex('applications_bounty_id_applicant_id_key').on(table.bountyId, table.applicantId),
    };
});

export const submissions = pgTable('submissions', {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id').references(() => bounties.id, { onDelete: 'cascade' }).notNull(),
    developerId: uuid('developer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    prUrl: text('pr_url').notNull(),
    supportingLinks: jsonb('supporting_links').$type<string[]>(),
    notes: text('notes'),
    status: submissionStatusEnum('status').default('pending').notNull(),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow(), // Note: DB trigger `update_submissions_updated_at` handles updates
}, (table) => {
    return {
        bountyIdx: index('submissions_bounty_id_idx').on(table.bountyId),
        developerIdx: index('submissions_developer_id_idx').on(table.developerId),
        statusIdx: index('submissions_status_idx').on(table.status),
    };
});


export const disputes = pgTable('disputes', {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }).notNull(),
    reason: text('reason').notNull(),
    evidenceLinks: jsonb('evidence_links').$type<string[]>(),
    status: disputeStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow(), // Note: DB trigger `update_disputes_updated_at` handles updates
}, (table) => {
    return {
        submissionIdx: index('disputes_submission_id_idx').on(table.submissionId),
        statusIdx: index('disputes_status_idx').on(table.status),
    };
});

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    bountyId: uuid('bounty_id').references(() => bounties.id, { onDelete: 'cascade' }).notNull(),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    recipientId: uuid('recipient_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    readAt: timestamp('read_at'),
}, (table) => {
    return {
        bountyCreatedAtIdx: index('messages_bounty_id_created_at_idx').on(table.bountyId, table.createdAt),
    };
});


