import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { disputes, submissions, bounties } from '../db/schema';

const disputesRouter = new Hono<{ Variables: Variables }>();

/**
 * POST /api/disputes/:id/resolve
 * Allows the bounty creator to resolve a dispute.
 *
 * resolution must be one of:
 *   - 'resolved_developer': developer wins — payout initiated, bounty → completed
 *   - 'resolved_creator':   creator wins  — submission rejected, bounty reopened (→ open)
 *
 * Only the bounty creator may resolve. Dispute must be in 'open' status.
 */
disputesRouter.post('/:id/resolve', async (c) => {
    const user = c.get('user');
    const disputeId = c.req.param('id');

    const dispute = await db.query.disputes.findFirst({
        where: eq(disputes.id, disputeId),
        columns: { id: true, submissionId: true, status: true },
    });

    if (!dispute) {
        return c.json({ error: 'Dispute not found' }, 404);
    }

    if (dispute.status !== 'open') {
        return c.json({ error: 'Dispute is already resolved' }, 422);
    }

    // Load submission to find the bounty
    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, dispute.submissionId),
        columns: { id: true, bountyId: true, developerId: true },
    });

    if (!submission) {
        return c.json({ error: 'Associated submission not found' }, 404);
    }

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, submission.bountyId),
        columns: { id: true, creatorId: true },
    });

    if (bounty?.creatorId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json();
    const { resolution } = body;

    if (resolution !== 'resolved_developer' && resolution !== 'resolved_creator') {
        return c.json({
            error: 'resolution must be either "resolved_developer" or "resolved_creator"',
        }, 400);
    }

    if (resolution === 'resolved_developer') {
        // Developer wins: approve submission, complete bounty, payout (atomic)
        await db.transaction(async (tx) => {
            await tx.update(disputes)
                .set({ status: 'resolved', updatedAt: new Date() })
                .where(eq(disputes.id, disputeId));

            await tx.update(submissions)
                .set({ status: 'approved', updatedAt: new Date() })
                .where(eq(submissions.id, dispute.submissionId));

            await tx.update(bounties)
                .set({ status: 'completed', updatedAt: new Date() })
                .where(eq(bounties.id, submission.bountyId));
        });

        // TODO: Trigger Stellar payout to submission.developerId

        return c.json({
            success: true,
            message: 'Dispute resolved in favour of the developer. Payment initiated.',
        });
    }

    // resolution === 'resolved_creator': creator wins — reopen bounty (atomic)
    await db.transaction(async (tx) => {
        await tx.update(disputes)
            .set({ status: 'dismissed', updatedAt: new Date() })
            .where(eq(disputes.id, disputeId));

        await tx.update(submissions)
            .set({ status: 'rejected', updatedAt: new Date() })
            .where(eq(submissions.id, dispute.submissionId));

        await tx.update(bounties)
            .set({ status: 'open', assigneeId: null, updatedAt: new Date() })
            .where(eq(bounties.id, submission.bountyId));
    });

    return c.json({
        success: true,
        message: 'Dispute dismissed. Bounty reopened for new assignment.',
    });
});

export default disputesRouter;
