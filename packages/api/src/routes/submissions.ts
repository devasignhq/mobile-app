import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { submissions, bounties, disputes } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

const submissionsRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/submissions/mine
 * Paginated list of the authenticated user's submissions.
 * Returns bounty title, status, and creation date.
 */
submissionsRouter.get('/mine', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || '10'), 100);
    const offset = Math.max(parseInt(query.offset || '0'), 0);

    const results = await db
        .select({
            id: submissions.id,
            bountyId: submissions.bountyId,
            bountyTitle: bounties.title,
            status: submissions.status,
            prUrl: submissions.prUrl,
            createdAt: submissions.createdAt,
            updatedAt: submissions.updatedAt,
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(eq(submissions.developerId, user.sub))
        .orderBy(desc(submissions.createdAt))
        .limit(limit + 1)
        .offset(offset);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return c.json({
        data,
        meta: {
            limit,
            offset,
            has_more: hasMore,
            count: data.length,
        },
    });
});

/**
 * GET /api/submissions/:id
 * Full submission details including review status, rejection reason, and associated dispute info.
 */
submissionsRouter.get('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const id = c.req.param('id');

    // Fetch the submission
    const submission = await db.query.submissions.findFirst({
        where: eq(submissions.id, id),
    });

    if (!submission) {
        return c.json({ error: 'Submission not found' }, 404);
    }

    // Only the developer who created the submission can view its full details
    if (submission.developerId !== user.sub) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Fetch associated bounty info
    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, submission.bountyId),
    });

    // Fetch associated disputes
    const relatedDisputes = await db.query.disputes.findMany({
        where: eq(disputes.submissionId, id),
        orderBy: [desc(disputes.createdAt)],
    });

    return c.json({
        id: submission.id,
        bountyId: submission.bountyId,
        bountyTitle: bounty?.title ?? null,
        developerId: submission.developerId,
        prUrl: submission.prUrl,
        supportingLinks: submission.supportingLinks,
        notes: submission.notes,
        status: submission.status,
        rejectionReason: submission.rejectionReason,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        disputes: relatedDisputes.map(d => ({
            id: d.id,
            reason: d.reason,
            evidenceLinks: d.evidenceLinks,
            status: d.status,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        })),
    });
});

export default submissionsRouter;
