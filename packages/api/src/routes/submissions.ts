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

export default submissionsRouter;
