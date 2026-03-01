import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { ensureBountyCreator, ensureBountyAssignee } from '../middleware/resource-auth';
import { db } from '../db';
import { bounties, applications } from '../db/schema';
import { eq, and, gte, lte, sql, desc, or, lt } from 'drizzle-orm';

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
 * Publicly accessible route to get bounty details
 */
bountiesRouter.get('/:id', async (c) => {
    const id = c.req.param('id');
    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, id),
    });

    if (!bounty) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    return c.json(bounty);
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

/**
 * POST /api/bounties/:id/apply
 * Submit an application for a bounty. Only one application per user per bounty.
 * Bounty must be in 'open' status. Requires cover_letter, estimated_time, and optional experience_links.
 * Closes #23.
 */
bountiesRouter.post('/:id/apply', async (c) => {
    const userId = c.get('user').id;
    const bountyId = c.req.param('id');

    // Validate bounty exists and is open
    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, bountyId),
    });

    if (!bounty) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    if (bounty.status !== 'open') {
        return c.json({ error: 'Bounty is not open for applications' }, 409);
    }

    // Prevent creator from applying to their own bounty
    if (bounty.creatorId === userId) {
        return c.json({ error: 'You cannot apply to your own bounty' }, 403);
    }

    // Parse and validate request body
    let body: { cover_letter: string; estimated_time: number; experience_links?: string[] };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { cover_letter, estimated_time, experience_links } = body;

    if (!cover_letter || typeof cover_letter !== 'string' || cover_letter.trim().length === 0) {
        return c.json({ error: 'cover_letter is required and must be a non-empty string' }, 400);
    }

    if (!estimated_time || typeof estimated_time !== 'number' || estimated_time <= 0 || !Number.isInteger(estimated_time)) {
        return c.json({ error: 'estimated_time is required and must be a positive integer (hours)' }, 400);
    }

    if (experience_links !== undefined) {
        if (!Array.isArray(experience_links) || experience_links.some(l => typeof l !== 'string')) {
            return c.json({ error: 'experience_links must be an array of strings' }, 400);
        }
    }

    // Check for duplicate application (unique constraint on bounty_id + applicant_id)
    const existing = await db.query.applications.findFirst({
        where: and(
            eq(applications.bountyId, bountyId),
            eq(applications.applicantId, userId),
        ),
    });

    if (existing) {
        return c.json({ error: 'You have already applied to this bounty' }, 409);
    }

    // Create the application
    const [created] = await db.insert(applications).values({
        bountyId,
        applicantId: userId,
        coverLetter: cover_letter.trim(),
        estimatedTime: estimated_time,
        experienceLinks: experience_links ?? [],
        status: 'pending',
    }).returning();

    return c.json({
        id: created.id,
        bounty_id: created.bountyId,
        applicant_id: created.applicantId,
        cover_letter: created.coverLetter,
        estimated_time: created.estimatedTime,
        experience_links: created.experienceLinks,
        status: created.status,
        created_at: created.createdAt,
    }, 201);
});

export default bountiesRouter;
