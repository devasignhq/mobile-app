import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { ensureBountyCreator, ensureBountyAssignee } from '../middleware/resource-auth';
import { db } from '../db';
import { bounties, users, applications } from '../db/schema';
import { eq, and, gte, lte, sql, desc, or, lt, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const bountiesRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/bounties
 * Paginated listing of bounties with filters.
 */
bountiesRouter.get('/', async (c) => {
    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || '10'), 100);
    const cursor = query.cursor;

    const {
        tech_stack,
        amount_min,
        amount_max,
        difficulty,
        status,
    } = query;

    // Input validation for difficulty and status
    const allowedDifficulties = ['beginner', 'intermediate', 'advanced'];
    const allowedStatuses = ['open', 'assigned', 'in_review', 'completed', 'cancelled'];

    if (difficulty && !allowedDifficulties.includes(difficulty)) {
        return c.json({ error: `Invalid difficulty. Allowed values are: ${allowedDifficulties.join(', ')}` }, 400);
    }

    if (status && !allowedStatuses.includes(status)) {
        return c.json({ error: `Invalid status. Allowed values are: ${allowedStatuses.join(', ')}` }, 400);
    }

    let whereClause = undefined;
    const filters = [];

    // Tech stack filter (JSONB containment)
    if (tech_stack) {
        const tags = Array.isArray(tech_stack) ? tech_stack : tech_stack.split(',');
        filters.push(sql`${bounties.techTags} @> ${JSON.stringify(tags)}::jsonb`);
    }

    // Amount range filter
    if (amount_min) {
        if (isNaN(Number(amount_min))) {
            return c.json({ error: 'Invalid amount_min. Must be a number.' }, 400);
        }
        filters.push(gte(bounties.amountUsdc, amount_min));
    }
    if (amount_max) {
        if (isNaN(Number(amount_max))) {
            return c.json({ error: 'Invalid amount_max. Must be a number.' }, 400);
        }
        filters.push(lte(bounties.amountUsdc, amount_max));
    }

    // Difficulty filter
    if (difficulty) {
        filters.push(eq(bounties.difficulty, difficulty as "beginner" | "intermediate" | "advanced"));
    }

    // Status filter
    if (status) {
        filters.push(eq(bounties.status, status as "open" | "assigned" | "in_review" | "completed" | "cancelled"));
    }

    // Cursor-based pagination logic
    if (cursor) {
        try {
            const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
            const { createdAt, id } = decodedCursor;

            // We sort by createdAt DESC, id DESC for stable pagination
            filters.push(
                or(
                    lt(bounties.createdAt, new Date(createdAt)),
                    and(
                        eq(bounties.createdAt, new Date(createdAt)),
                        lt(bounties.id, id)
                    )
                )
            );
        } catch (e) {
            return c.json({ error: 'Invalid cursor' }, 400);
        }
    }

    if (filters.length > 0) {
        whereClause = and(...filters);
    }

    const results = await db.query.bounties.findMany({
        where: whereClause,
        limit: limit + 1, // Fetch one extra to see if there's more
        orderBy: [desc(bounties.createdAt), desc(bounties.id)],
    });

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    let nextCursor = null;
    if (hasMore && data.length > 0) {
        const lastItem = data[data.length - 1];
        nextCursor = Buffer.from(JSON.stringify({
            createdAt: lastItem.createdAt.toISOString(),
            id: lastItem.id
        })).toString('base64');
    }

    return c.json({
        data,
        meta: {
            next_cursor: nextCursor,
            has_more: hasMore,
            count: data.length,
        },
    });
});

/**
 * GET /api/bounties/recommended
 * Personalized recommendations for the authenticated user based on tech tags matching.
 */
interface RecommendedCacheEntry {
    data: any[];
    timestamp: number;
}
const recommendedCache = new Map<string, RecommendedCacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

bountiesRouter.get('/recommended', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check cache
    const cached = recommendedCache.get(user.id);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return c.json({ data: cached.data });
    }

    // Fetch user profile to get tech stack
    const userProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
    });

    const techStack = userProfile?.techStack || [];

    // Fetch all open bounties
    const openBounties = await db.query.bounties.findMany({
        where: eq(bounties.status, 'open'),
        orderBy: [desc(bounties.createdAt)],
    });

    let results = [];

    // If no tech stack, just return latest open bounties
    if (techStack.length === 0) {
        results = openBounties.slice(0, 10);
    } else {
        // Calculate relevance score
        const scoredBounties = openBounties.map(bounty => {
            let score = 0;
            const bountyTags = bounty.techTags || [];
            for (const tag of bountyTags) {
                if (techStack.includes(tag)) {
                    score++;
                }
            }
            return {
                ...bounty,
                relevanceScore: score,
            };
        });

        // Sort by relevance score (desc), then by createdAt (desc)
        scoredBounties.sort((a, b) => {
            if (b.relevanceScore !== a.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
            }
            return b.createdAt.getTime() - a.createdAt.getTime();
        });

        results = scoredBounties.slice(0, 10).map(({ relevanceScore, ...rest }) => rest);
    }

    // Save to cache
    recommendedCache.set(user.id, { data: results, timestamp: Date.now() });

    return c.json({ data: results });
});

/**
 * GET /api/bounties/:id
 * Publicly accessible route to get bounty details
 */
bountiesRouter.get('/:id', async (c) => {
    const id = c.req.param('id');


    const assigneeTable = alias(users, 'assignee');

    const result = await db.select({
        bounty: bounties,
        creator: {
            username: users.username,
            avatarUrl: users.avatarUrl,
        },
        assignee: {
            username: assigneeTable.username,
            avatarUrl: assigneeTable.avatarUrl,
        },
    })
        .from(bounties)
        .leftJoin(users, eq(bounties.creatorId, users.id))
        .leftJoin(assigneeTable, eq(bounties.assigneeId, assigneeTable.id))
        .where(eq(bounties.id, id));

    if (!result || result.length === 0) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    const bountyData = result[0];

    const appCountResult = await db.select({ count: count() })
        .from(applications)
        .where(eq(applications.bountyId, id));

    const applicationCount = appCountResult[0]?.count || 0;

    return c.json({
        ...bountyData.bounty,
        creator: bountyData.creator,
        assignee: bountyData.bounty.assigneeId ? bountyData.assignee : null,
        applicationCount,
    });
});

/**
 * PATCH /api/bounties/:id
 * Only the creator of the bounty can update it.
 */
bountiesRouter.patch('/:id', ensureBountyCreator('id'), async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    // In a real app, we would validate the body here

    await db.update(bounties)
        .set({
            ...body,
            updatedAt: new Date(),
        })
        .where(eq(bounties.id, id));

    return c.json({ success: true, message: 'Bounty updated' });
});

/**
 * POST /api/bounties/:id/complete
 * Only the assigned developer can mark a bounty for completion (submit for review)
 */
bountiesRouter.post('/:id/complete', ensureBountyAssignee('id'), async (c) => {
    const id = c.req.param('id');

    await db.update(bounties)
        .set({
            status: 'in_review',
            updatedAt: new Date(),
        })
        .where(eq(bounties.id, id));

    return c.json({ success: true, message: 'Bounty submitted for review' });
});

export default bountiesRouter;
