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

/**
 * POST /api/submissions/:id/dispute
 * Allows the developer to open a dispute on a rejected submission.
 * Validates:
 *   - Submission exists and belongs to the requesting user
 *   - Submission status is 'rejected'
 *   - No existing open dispute for this submission
 * Creates a dispute record with status 'open'.
 */
submissionsRouter.post('/:id/dispute', async (c) => {
    const user = c.get('user');
    const submissionId = c.req.param('id');

    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, submissionId),
        columns: { id: true, developerId: true, status: true },
    });

    if (!submission) {
        return c.json({ error: 'Submission not found' }, 404);
    }

    if (submission.developerId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    if (submission.status !== 'rejected') {
        return c.json({ error: 'Can only dispute a rejected submission' }, 422);
    }

    // Prevent duplicate disputes
    const existing = await db.query.disputes.findFirst({
        where: eq(disputes.submissionId, submissionId),
        columns: { id: true },
    });

    if (existing) {
        return c.json({ error: 'A dispute already exists for this submission' }, 409);
    }

    const body = await c.req.json();
    const { reason, evidence_links } = body;

    if (typeof reason !== 'string' || reason.trim() === '') {
        return c.json({ error: 'reason is required and must be a non-empty string' }, 400);
    }

    const evidenceLinks: string[] = Array.isArray(evidence_links) ? evidence_links : [];

    const [created] = await db.insert(disputes).values({
        submissionId,
        reason: reason.trim(),
        evidenceLinks,
        status: 'open',
    }).returning();

    return c.json({
        id: created.id,
        submission_id: created.submissionId,
        reason: created.reason,
        evidence_links: created.evidenceLinks,
        status: created.status,
        created_at: created.createdAt,
    }, 201);
});

/**
 * POST /api/submissions/:id/approve
 * Allows the bounty creator to approve a submission.
 * Transitions the submission to 'approved' and the bounty to 'completed'.
 * Payment flow is initiated (placeholder for actual Stellar payout).
 */
submissionsRouter.post('/:id/approve', async (c) => {
    const user = c.get('user');
    const submissionId = c.req.param('id');

    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, submissionId),
        columns: { id: true, bountyId: true, developerId: true, status: true },
    });

    if (!submission) {
        return c.json({ error: 'Submission not found' }, 404);
    }

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, submission.bountyId),
        columns: { id: true, creatorId: true },
    });

    if (bounty?.creatorId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    if (submission.status !== 'pending') {
        return c.json({ error: 'Only pending submissions can be approved' }, 422);
    }

    // Transition submission → approved, bounty → completed (atomic)
    await db.transaction(async (tx) => {
        await tx.update(submissions)
            .set({ status: 'approved', updatedAt: new Date() })
            .where(eq(submissions.id, submissionId));

        await tx.update(bounties)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(bounties.id, submission.bountyId));
    });

    // TODO: Trigger Stellar payout to submission.developerId

    return c.json({ success: true, message: 'Submission approved and payment initiated' });
});

/**
 * POST /api/submissions/:id/reject
 * Allows the bounty creator to reject a submission.
 * Requires a rejection_reason. Transitions the submission to 'rejected'
 * and the bounty back to 'assigned' so the developer can revise.
 */
submissionsRouter.post('/:id/reject', async (c) => {
    const user = c.get('user');
    const submissionId = c.req.param('id');

    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, submissionId),
        columns: { id: true, bountyId: true, status: true },
    });

    if (!submission) {
        return c.json({ error: 'Submission not found' }, 404);
    }

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, submission.bountyId),
        columns: { id: true, creatorId: true },
    });

    if (bounty?.creatorId !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    if (submission.status !== 'pending') {
        return c.json({ error: 'Only pending submissions can be rejected' }, 422);
    }

    const body = await c.req.json();
    const { rejection_reason } = body;

    if (typeof rejection_reason !== 'string' || rejection_reason.trim() === '') {
        return c.json({ error: 'rejection_reason is required and must be a non-empty string' }, 400);
    }

    // Transition submission → rejected, bounty → assigned (atomic)
    await db.transaction(async (tx) => {
        await tx.update(submissions)
            .set({ status: 'rejected', rejectionReason: rejection_reason.trim(), updatedAt: new Date() })
            .where(eq(submissions.id, submissionId));

        await tx.update(bounties)
            .set({ status: 'assigned', updatedAt: new Date() })
            .where(eq(bounties.id, submission.bountyId));
    });

    return c.json({ success: true, message: 'Submission rejected' });
});

export default submissionsRouter;
