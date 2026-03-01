import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { submissions, bounties, disputes } from '../db/schema';

const submissionsRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/submissions/:id
 * Returns full submission details including review status, rejection reason,
 * and associated dispute info. Only the submission owner or bounty creator
 * may access.
 */
submissionsRouter.get('/:id', async (c) => {
    const user = c.get('user');
    const submissionId = c.req.param('id');

    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, submissionId),
        columns: {
            id: true,
            bountyId: true,
            developerId: true,
            prUrl: true,
            supportingLinks: true,
            notes: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!submission) {
        return c.json({ error: 'Submission not found' }, 404);
    }

    // Only the submitter or the bounty creator may view
    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, submission.bountyId),
        columns: { id: true, creatorId: true, title: true },
    });

    if (submission.developerId !== user.id && bounty?.creatorId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Fetch associated dispute if any
    const dispute = await db.query.disputes.findFirst({
        where: eq(disputes.submissionId, submissionId),
        columns: {
            id: true,
            reason: true,
            evidenceLinks: true,
            status: true,
            createdAt: true,
        },
    });

    return c.json({
        id: submission.id,
        bounty_id: submission.bountyId,
        bounty_title: bounty?.title ?? null,
        developer_id: submission.developerId,
        pr_url: submission.prUrl,
        supporting_links: submission.supportingLinks,
        notes: submission.notes,
        status: submission.status,
        rejection_reason: submission.rejectionReason,
        dispute: dispute ? {
            id: dispute.id,
            reason: dispute.reason,
            evidence_links: dispute.evidenceLinks,
            status: dispute.status,
            created_at: dispute.createdAt,
        } : null,
        created_at: submission.createdAt,
        updated_at: submission.updatedAt,
    });
});

export default submissionsRouter;
