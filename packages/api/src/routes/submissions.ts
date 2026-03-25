import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, disputes, transactions } from '../db/schema';
import { eq, desc, count, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const submissionsRouter = new Hono<{ Variables: Variables }>();

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const rejectSchema = z.object({
    rejection_reason: z.string().min(1, { message: 'Rejection reason is required' }),
});

const disputeSchema = z.object({
    reason: z.string().min(1, { message: 'Reason is required' }),
    evidence_links: z.array(z.string().url()).optional(),
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


const disputeSchema = z.object({
    reason: z.string().min(1).max(2000),
    evidence_links: z.array(z.string().url()).optional().default([]),
});

/**
 * POST /api/submissions/:id/dispute
 * Opens a dispute for a rejected submission.
 * Validates that submission was rejected and belongs to the authenticated user.
 */
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

    }
);


/**
 * POST /api/submissions/:id/approve
 * Approves a submission and triggers payment payout to the developer.
 * Must be accessed by the bounty creator.
 */
submissionsRouter.post(
    '/:id/approve',
    zValidator('param', idSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');

        const result = await db.select({
            submission: submissions,
            bounty: bounties,
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(eq(submissions.id, id));

        if (result.length === 0) {
            return c.json({ error: 'Submission not found' }, 404);
        }

        const { submission, bounty } = result[0];

        if (bounty.creatorId !== user.id) {
            return c.json({ error: 'Forbidden. Only the bounty creator can approve submissions.' }, 403);
        }

        if (submission.status !== 'pending' && submission.status !== 'disputed') {
            return c.json({ error: 'Only pending or disputed submissions can be approved.' }, 400);
        }

        // Use a transaction to mark the submission as approved and create a payout transaction.
        try {
            await db.transaction(async (tx) => {
                const updated = await tx.update(submissions)
                    .set({ status: 'approved' })
                    .where(and(
                        eq(submissions.id, id),
                        eq(submissions.status, submission.status)
                    ))
                    .returning({ id: submissions.id });

                if (updated.length === 0) {
                    tx.rollback();
                }

                // Create a payment transaction
                await tx.insert(transactions).values({
                    userId: submission.developerId,
                    type: 'bounty_payout',
                    amountUsdc: bounty.amountUsdc,
                    bountyId: bounty.id,
                    status: 'pending'
                });

                // Update the bounty status to completed
                await tx.update(bounties)
                    .set({ status: 'completed' })
                    .where(eq(bounties.id, bounty.id));
            });

            return c.json({ message: 'Submission approved and payment triggered successfully' }, 200);
        } catch (error) {
            return c.json({ error: 'Failed to approve submission or it was modified concurrently' }, 409);
        }
    }
);

/**
 * POST /api/submissions/:id/reject
 * Rejects a submission and requires a reason.
 * Must be accessed by the bounty creator.
 */
submissionsRouter.post(
    '/:id/reject',
    zValidator('param', idSchema),
    zValidator('json', rejectSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');
        const { rejection_reason } = c.req.valid('json');

        const result = await db.select({
            submission: submissions,
            bounty: bounties,
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(eq(submissions.id, id));

        if (result.length === 0) {
            return c.json({ error: 'Submission not found' }, 404);
        }

        const { submission, bounty } = result[0];

        if (bounty.creatorId !== user.id) {
            return c.json({ error: 'Forbidden. Only the bounty creator can reject submissions.' }, 403);
        }

        if (submission.status !== 'pending' && submission.status !== 'disputed') {
            return c.json({ error: 'Only pending or disputed submissions can be rejected.' }, 400);
        }

        try {
            await db.transaction(async (tx) => {
                const updated = await tx.update(submissions)
                    .set({
                        status: 'rejected',
                        rejectionReason: rejection_reason
                    })
                    .where(and(
                        eq(submissions.id, id),
                        eq(submissions.status, submission.status)
                    ))
                    .returning({ id: submissions.id });

                if (updated.length === 0) {
                    tx.rollback();
                }

                await tx.update(bounties)
                    .set({ status: 'assigned' })
                    .where(eq(bounties.id, bounty.id));
            });

            return c.json({ message: 'Submission rejected successfully' }, 200);
        } catch (error) {
            return c.json({ error: 'Failed to reject submission or it was modified concurrently' }, 409);
        }
    }
);

export default submissionsRouter;