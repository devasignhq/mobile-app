import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { ensureBountyCreator, ensureBountyAssignee } from '../middleware/resource-auth';
import { db } from '../db';
import { bounties, users, applications } from '../db/schema';
import { eq, and, gte, lte, sql, desc, or, lt, count } from 'drizzle-orm';

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
 * GET /api/bounties/:id
 * Returns full bounty details including creator info (username, avatar),
 * application count, assignee info if assigned, and current status.
 */
bountiesRouter.get('/:id', async (c) => {
    const id = c.req.param('id');

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, id),
    });

    if (!bounty) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    // Fetch creator, assignee, and application count in parallel
    const [creator, assigneeResult, appCount] = await Promise.all([
        db.query.users.findFirst({
            where: eq(users.id, bounty.creatorId),
            columns: { id: true, username: true, avatarUrl: true },
        }),
        bounty.assigneeId
            ? db.query.users.findFirst({
                  where: eq(users.id, bounty.assigneeId),
                  columns: { id: true, username: true, avatarUrl: true },
              })
            : Promise.resolve(null),
        db
            .select({ count: count() })
            .from(applications)
            .where(eq(applications.bountyId, id)),
    ]);

    const assignee = assigneeResult ?? null;
    const applicationCount = Number(appCount[0]?.count ?? 0);

    return c.json({
        ...bounty,
        creator: creator ?? null,
        assignee,
        application_count: applicationCount,
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
