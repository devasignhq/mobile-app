import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, extensionRequests } from '../db/schema';

const tasksRouter = new Hono<{ Variables: Variables }>();

/**
 * POST /api/tasks/:bountyId/extend
 * Allows the assigned developer to request a deadline extension.
 */
tasksRouter.post('/:bountyId/extend', async (c) => {
    const user = c.get('user');
    const bountyId = c.req.param('bountyId');

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, bountyId),
        columns: {
            id: true,
            assigneeId: true,
            deadline: true,
        },
    });

    if (!bounty) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    if (bounty.assigneeId !== user.id) {
        return c.json({ error: 'Forbidden: You must be the assigned developer' }, 403);
    }

    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const payload = body as { new_deadline?: unknown };

    if (typeof payload.new_deadline !== 'string' || payload.new_deadline.trim() === '') {
        return c.json({ error: 'new_deadline is required and must be a non-empty ISO date string' }, 400);
    }

    const newDeadline = new Date(payload.new_deadline);
    if (Number.isNaN(newDeadline.getTime())) {
        return c.json({ error: 'new_deadline must be a valid date string' }, 400);
    }

    const now = new Date();
    if (newDeadline <= now) {
        return c.json({ error: 'new_deadline must be in the future' }, 400);
    }

    if (bounty.deadline && newDeadline <= bounty.deadline) {
        return c.json({ error: 'new_deadline must be later than the current deadline' }, 400);
    }

    const existingPending = await db.query.extensionRequests.findFirst({
        where: and(
            eq(extensionRequests.bountyId, bountyId),
            eq(extensionRequests.developerId, user.id),
            eq(extensionRequests.status, 'pending')
        ),
        columns: {
            id: true,
        },
    });

    if (existingPending) {
        return c.json({ error: 'An active extension request already exists for this bounty' }, 409);
    }

    await db.insert(extensionRequests).values({
        bountyId,
        developerId: user.id,
        newDeadline,
        status: 'pending',
    });

    return c.json({ success: true, message: 'Extension request submitted' });
});

export default tasksRouter;
