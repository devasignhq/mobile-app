import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, disputes, transactions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const disputesRouter = new Hono<{ Variables: Variables }>();

const idSchema = z.object({
    id: z.string().uuid(),
});

const resolveSchema = z.object({
    resolution: z.enum(['resolved_developer', 'resolved_creator']),
});

/**
 * POST /api/disputes/:id/resolve
 * Resolves a dispute either in favor of the developer or the creator.
 * Must be accessed by the bounty creator.
 */
disputesRouter.post(
    '/:id/resolve',
    zValidator('param', idSchema),
    zValidator('json', resolveSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { id } = c.req.valid('param');
        const { resolution } = c.req.valid('json');

        const result = await db.select({
            dispute: disputes,
            submission: submissions,
            bounty: bounties,
        })
        .from(disputes)
        .innerJoin(submissions, eq(disputes.submissionId, submissions.id))
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(eq(disputes.id, id));

        if (result.length === 0) {
            return c.json({ error: 'Dispute not found' }, 404);
        }

        const { dispute, submission, bounty } = result[0];

        if (bounty.creatorId !== user.id) {
            return c.json({ error: 'Forbidden. Only the bounty creator can resolve disputes.' }, 403);
        }

        if (dispute.status !== 'open') {
            return c.json({ error: 'Dispute has already been resolved or dismissed.' }, 400);
        }

        try {
            await db.transaction(async (tx) => {
                if (resolution === 'resolved_developer') {
                    // Update dispute status
                    const updated = await tx.update(disputes)
                        .set({ status: 'resolved' })
                        .where(and(eq(disputes.id, id), eq(disputes.status, 'open')))
                        .returning({ id: disputes.id });

                    if (updated.length === 0) {
                        tx.rollback();
                    }

                    // Update submission status to approved
                    await tx.update(submissions)
                        .set({ status: 'approved' })
                        .where(eq(submissions.id, submission.id));

                    // Mark bounty as completed
                    await tx.update(bounties)
                        .set({ status: 'completed' })
                        .where(eq(bounties.id, bounty.id));

                    // Generate payout transaction
                    await tx.insert(transactions).values({
                        userId: submission.developerId,
                        type: 'bounty_payout',
                        amountUsdc: bounty.amountUsdc,
                        bountyId: bounty.id,
                        status: 'pending'
                    });
                } else if (resolution === 'resolved_creator') {
                    // Reject developer's dispute: mark as dismissed
                    const updated = await tx.update(disputes)
                        .set({ status: 'dismissed' })
                        .where(and(eq(disputes.id, id), eq(disputes.status, 'open')))
                        .returning({ id: disputes.id });

                    if (updated.length === 0) {
                        tx.rollback();
                    }

                    // Reopen bounty for new assignment
                    await tx.update(bounties)
                        .set({ 
                            status: 'open',
                            assigneeId: null
                        })
                        .where(eq(bounties.id, bounty.id));
                        
                    // Note: submission status remains 'rejected'
                }
            });

            return c.json({ message: 'Dispute resolved successfully' }, 200);
        } catch (error) {
            return c.json({ error: 'Failed to resolve dispute or records were modified concurrently' }, 409);
        }
    }
);

export default disputesRouter;
