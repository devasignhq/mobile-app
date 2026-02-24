import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { ensureBountyCreator, ensureBountyAssignee } from '../middleware/resource-auth';
import { db } from '../db';
import { bounties } from '../db/schema';
import { eq } from 'drizzle-orm';

const bountiesRouter = new Hono<{ Variables: Variables }>();

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

export default bountiesRouter;
