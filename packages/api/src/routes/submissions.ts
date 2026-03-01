import { Hono } from 'hono';
import { eq, desc, inArray, lt, and } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { submissions, bounties } from '../db/schema';

const submissionsRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/submissions/mine
 * Returns paginated list of the authenticated user's submissions
 * with bounty title, status, and creation date.
 */
submissionsRouter.get('/mine', async (c) => {
    const user = c.get('user');
    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || '10'), 100);
    const cursor = query.cursor;

    const whereClause = cursor
        ? and(eq(submissions.developerId, user.id), lt(submissions.createdAt, new Date(cursor)))
        : eq(submissions.developerId, user.id);

    const mySubmissions = await db.query.submissions.findMany({
        where: whereClause,
        columns: {
            id: true,
            bountyId: true,
            status: true,
            prUrl: true,
            notes: true,
            createdAt: true,
        },
        orderBy: [desc(submissions.createdAt)],
        limit: limit + 1,
    });

    const hasMore = mySubmissions.length > limit;
    const page = hasMore ? mySubmissions.slice(0, limit) : mySubmissions;

    // Fetch bounty titles for the page
    const bountyIds = [...new Set(page.map(s => s.bountyId))];
    const bountyTitles = bountyIds.length > 0
        ? await db.query.bounties.findMany({
            where: inArray(bounties.id, bountyIds),
            columns: { id: true, title: true },
        })
        : [];
    const titleMap = new Map(bountyTitles.map(b => [b.id, b.title]));

    return c.json({
        data: page.map(s => ({
            id: s.id,
            bounty_id: s.bountyId,
            bounty_title: titleMap.get(s.bountyId) ?? null,
            status: s.status,
            pr_url: s.prUrl,
            notes: s.notes,
            created_at: s.createdAt,
        })),
        meta: {
            count: page.length,
            has_more: hasMore,
            next_cursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
        },
    });
});

export default submissionsRouter;
