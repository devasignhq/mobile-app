import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions } from '../db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const submissionsRouter = new Hono<{ Variables: Variables }>();

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
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

export default submissionsRouter;
