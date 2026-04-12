import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { githubService } from '../services/github';
import { db } from '../db';
import { bounties, submissions, users, extensionRequests } from '../db/schema';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { ensureBountyAssignee } from '../middleware/resource-auth';
import { BountyNotFoundError, InvalidBountyStatusError, InvalidDeadlineError } from '../utils/errors';

const tasksRouter = new Hono<{ Variables: Variables }>();

const submitWorkSchema = z.object({
    pr_url: z.string().url('Invalid PR URL'),
    supporting_links: z.array(z.string().url('Invalid supporting link URL')).optional().default([]),
    notes: z.string().optional(),
});

const extendDeadlineSchema = z.object({
    new_deadline: z.coerce.date().refine((date) => date > new Date(), {
        message: 'New deadline must be in the future',
    }),
});

/**
 * GET /api/tasks
 * Returns the authenticated user's assigned bounties grouped by status.
 * Includes bounty details, deadline, creator info, and submission status if work has been submitted.
 */
tasksRouter.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const creatorTable = alias(users, 'creator');

    // Query all bounties assigned to the current user, join with submissions and creator info
    const results = await db.select({
        bounty: {
            id: bounties.id,
            title: bounties.title,
            description: bounties.description,
            amountUsdc: bounties.amountUsdc,
            techTags: bounties.techTags,
            difficulty: bounties.difficulty,
            status: bounties.status,
            deadline: bounties.deadline,
            createdAt: bounties.createdAt,
            updatedAt: bounties.updatedAt,
        },
        creator: {
            username: creatorTable.username,
            avatarUrl: creatorTable.avatarUrl,
        },
        submission: {
            id: submissions.id,
            prUrl: submissions.prUrl,
            status: submissions.status,
            createdAt: submissions.createdAt,
        },
    })
        .from(bounties)
        .leftJoin(creatorTable, eq(bounties.creatorId, creatorTable.id))
        .leftJoin(submissions, eq(bounties.id, submissions.bountyId))
        .where(eq(bounties.assigneeId, user.id));

    // Derive status groups from schema to stay in sync with enum changes
    const initialGroups = bounties.status.enumValues.reduce((acc, status) => {
        acc[status] = [];
        return acc;
    }, {} as Record<string, any[]>);

    const grouped = results.reduce((acc, row) => {
        const status = row.bounty.status;
        const item = {
            ...row.bounty,
            creator: row.creator,
            submission: row.submission?.id ? row.submission : null,
        };
        acc[status].push(item);
        return acc;
    }, initialGroups);

    return c.json({
        data: grouped,
        meta: {
            total: results.length,
        },
    });
});

/**
 * POST /api/tasks/:id/submit
 * Submit work for an assigned bounty.
 * Body: { pr_url: string, supporting_links?: string[], notes?: string }
 */
tasksRouter.post(
    '/:id/submit',
    ensureBountyAssignee('id'),
    zValidator('json', submitWorkSchema),
    async (c) => {
        const user = c.get('user');
        const id = c.req.param('id');
        const { pr_url, supporting_links, notes } = c.req.valid('json');

        try {
            // Fetch bounty outside transaction for validation
            const bounty = await db.query.bounties.findFirst({
                where: eq(bounties.id, id),
            });

            if (!bounty) {
                return c.json({ error: 'Bounty not found' }, 404);
            }

            if (bounty.status !== 'assigned') {
                return c.json({ error: `Cannot submit work for bounty with status: ${bounty.status}` }, 400);
            }

            // GitHub PR Validation
            const parsedUrl = new URL(pr_url);
            const prMatch = parsedUrl.pathname.match(/^\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);

            if (parsedUrl.hostname.toLowerCase() !== 'github.com' || !prMatch) {
                return c.json({ error: 'Invalid GitHub PR URL format' }, 400);
            }

            const [, prOwner, prRepo, prNumberStr] = prMatch;

            if (
                !bounty.repoOwner ||
                !bounty.repoName ||
                prOwner.toLowerCase() !== bounty.repoOwner.toLowerCase() ||
                prRepo.toLowerCase() !== bounty.repoName.toLowerCase()
            ) {
                return c.json({ error: 'PR does not belong to the correct repository for this bounty' }, 400);
            }

            try {
                const prData = await githubService.getPRDetails(prOwner, prRepo, parseInt(prNumberStr, 10));
                if (!prData) {
                    return c.json({ error: 'Pull Request not found on GitHub' }, 400);
                }
                
                if (!user.username || prData.user?.login?.toLowerCase() !== user.username.toLowerCase()) {
                    return c.json({ error: 'You are not the author of this Pull Request' }, 400);
                }
            } catch (err) {
                return c.json({ error: 'Failed to verify Pull Request with GitHub' }, 502);
            }

            const result = await db.transaction(async (tx) => {
                // Double-check status inside transaction to avoid race conditions
                const currentBounty = await tx.query.bounties.findFirst({
                    where: eq(bounties.id, id),
                });

                if (!currentBounty) {
                    throw new BountyNotFoundError();
                }

                if (currentBounty.status !== 'assigned') {
                    throw new InvalidBountyStatusError(`Cannot submit work for bounty with status: ${currentBounty.status}`);
                }

                // 2. Create submission
                const [submission] = await tx.insert(submissions).values({
                    bountyId: id,
                    developerId: user.id,
                    prUrl: pr_url,
                    supportingLinks: supporting_links,
                    notes: notes,
                    status: 'pending',
                }).returning();

                // 3. Update bounty status to 'in_review'
                await tx.update(bounties)
                    .set({
                        status: 'in_review',
                        updatedAt: new Date(),
                    })
                    .where(eq(bounties.id, id));

                return submission;
            });

            return c.json(result, 201);
        } catch (err: any) {
            if (err instanceof BountyNotFoundError) {
                return c.json({ error: err.message }, 404);
            }
            if (err instanceof InvalidBountyStatusError) {
                return c.json({ error: err.message }, 400);
            }
            // Handle PostgreSQL unique constraint violation
            if (err.code === '23505') {
                return c.json({ error: 'A submission for this bounty already exists.' }, 409);
            }
            throw err;
        }
    }
);

/**
 * POST /api/tasks/:id/extend
 * Request a deadline extension for an assigned bounty.
 * Body: { new_deadline: string | date }
 */
tasksRouter.post(
    '/:id/extend',
    ensureBountyAssignee('id'),
    zValidator('json', extendDeadlineSchema),
    async (c) => {
        const user = c.get('user');
        const id = c.req.param('id');
        const { new_deadline } = c.req.valid('json');

        try {
            const result = await db.transaction(async (tx) => {
                // 1. Verify bounty is in 'assigned' status
                const bounty = await tx.query.bounties.findFirst({
                    where: eq(bounties.id, id),
                });

                if (!bounty) {
                    throw new BountyNotFoundError();
                }

                if (bounty.status !== 'assigned') {
                    throw new InvalidBountyStatusError(`Cannot extend deadline for bounty with status: ${bounty.status}`);
                }

                if (bounty.deadline && new_deadline <= bounty.deadline) {
                    throw new InvalidDeadlineError('New deadline must be after the current deadline');
                }

                // 2. Create extension request
                const [extensionRequest] = await tx.insert(extensionRequests).values({
                    bountyId: id,
                    developerId: user.id,
                    newDeadline: new_deadline,
                    status: 'pending',
                }).returning();

                return extensionRequest;
            });

            return c.json(result, 201);
        } catch (err: any) {
            if (err instanceof BountyNotFoundError) {
                return c.json({ error: err.message }, 404);
            }
            if (err instanceof InvalidBountyStatusError) {
                return c.json({ error: err.message }, 400);
            }
            if (err instanceof InvalidDeadlineError) {
                return c.json({ error: err.message }, 400);
            }
            // Handle PostgreSQL unique constraint violation
            if (err.code === '23505') {
                return c.json({ error: 'An active extension request already exists for this bounty.' }, 409);
            }
            throw err;
        }
    }
);

export default tasksRouter;
