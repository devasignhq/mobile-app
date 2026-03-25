import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, disputes } from '../db/schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const submissionsRouter = new Hono<{ Variables: Variables }>();

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const idSchema = z.object({
    id: z.string().uuid(),
});

/**
 * GET /api/submissions/mine
 * Returns a paginated list of the authenticated user's submissions
 * with bounty title, status, and creation date.
 */
submissionsRouter.get(
    '/mine',
    zValidator('query', paginationSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { page, limit } = c.req.valid('query');
        const offset = (page - 1) * limit;

        const results = await db.select({
            id: submissions.id,
            prUrl: submissions.prUrl,
            status: submissions.status,
            createdAt: submissions.createdAt,
            bounty: {
                id: bounties.id,
                title: bounties.title,
            }
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(eq(submissions.developerId, user.id))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

        // Get total count for pagination metadata
        const [totalCountResult] = await db.select({
            count: count()
        })
        .from(submissions)
        .where(eq(submissions.developerId, user.id));

        const total = totalCountResult.count;

        return c.json({
            data: results,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
);

/**
 * GET /api/submissions/:id
 * Returns full submission details including review status, rejection reason, and dispute info.
 */
submissionsRouter.get(
    '/:id',
    zValidator('param', idSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');

        const result = await db.select({
            submission: submissions,
            dispute: disputes,
        })
        .from(submissions)
        .leftJoin(disputes, eq(submissions.id, disputes.submissionId))
        .where(and(eq(submissions.id, id), eq(submissions.developerId, user.id)));

        if (result.length === 0) {
            return c.json({ error: 'Submission not found' }, 404);
        }

        const { submission, dispute } = result[0];

        return c.json({
            data: {
                ...submission,
                dispute: dispute || null,
            }
        });
    }
);

/**
 * POST /api/submissions/:id/dispute
 * Allows a developer to dispute a rejected submission.
 * Validates submission was rejected and belongs to the user.
 * Creates a dispute record with 'open' status and transitions
 * the submission status to 'disputed'.
 */
const disputeSchema = z.object({
    reason: z.string().min(1, 'Dispute reason is required').max(2000),
    evidence_links: z.array(z.string().url()).optional().default([]),
});

submissionsRouter.post(
    '/:id/dispute',
    zValidator('param', idSchema),
    zValidator('json', disputeSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');
        const { reason, evidence_links } = c.req.valid('json');

        // Fetch the submission and verify ownership + status
        const [submission] = await db
            .select()
            .from(submissions)
            .where(and(eq(submissions.id, id), eq(submissions.developerId, user.id)));

        if (!submission) {
            return c.json({ error: 'Submission not found' }, 404);
        }

        if (submission.status !== 'rejected') {
            return c.json(
                { error: 'Only rejected submissions can be disputed' },
                400
            );
        }

        // Check if a dispute already exists for this submission
        const [existingDispute] = await db
            .select()
            .from(disputes)
            .where(eq(disputes.submissionId, id));

        if (existingDispute) {
            return c.json(
                { error: 'A dispute already exists for this submission' },
                409
            );
        }

        // Create the dispute and update submission status in a transaction
        const [dispute] = await db.transaction(async (tx) => {
            const [newDispute] = await tx
                .insert(disputes)
                .values({
                    submissionId: id,
                    reason,
                    evidenceLinks: evidence_links,
                    status: 'open',
                })
                .returning();

            await tx
                .update(submissions)
                .set({ status: 'disputed' })
                .where(eq(submissions.id, id));

            return [newDispute];
        });

        return c.json({ data: dispute }, 201);
    }
);

export default submissionsRouter;
