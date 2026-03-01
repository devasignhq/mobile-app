import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, extensionRequests } from '../db/schema';
import { ensureBountyAssignee } from '../middleware/resource-auth';

const tasksRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/tasks
 * Returns the authenticated developer's assigned bounties grouped by status,
 * with the latest submission per bounty attached.
 */
tasksRouter.get('/', async (c) => {
    const user = c.get('user');

    const assignedBounties = await db.query.bounties.findMany({
        where: eq(bounties.assigneeId, user.id),
        columns: {
            id: true,
            title: true,
            amountUsdc: true,
            status: true,
            deadline: true,
            techTags: true,
        },
    });

    if (assignedBounties.length === 0) {
        return c.json({ data: {}, meta: { total: 0 } });
    }

    const bountyIds = assignedBounties.map((b) => b.id);

    const mySubmissions = await db.query.submissions.findMany({
        where: (s, { and, inArray: inArr }) => and(
            eq(s.developerId, user.id),
            inArr(s.bountyId, bountyIds),
        ),
        columns: {
            id: true,
            bountyId: true,
            prUrl: true,
            status: true,
            createdAt: true,
        },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    // Build a map of bountyId → latest submission
    const latestSubmissionByBounty: Record<string, typeof mySubmissions[number]> = {};
    for (const sub of mySubmissions) {
        if (!latestSubmissionByBounty[sub.bountyId]) {
            latestSubmissionByBounty[sub.bountyId] = sub;
        }
    }

    // Group bounties by status
    const grouped: Record<string, unknown[]> = {};
    for (const bounty of assignedBounties) {
        if (!grouped[bounty.status]) {
            grouped[bounty.status] = [];
        }
        grouped[bounty.status].push({
            ...bounty,
            latest_submission: latestSubmissionByBounty[bounty.id] ?? null,
        });
    }

    return c.json({ data: grouped, meta: { total: assignedBounties.length } });
});

/**
 * POST /api/tasks/:bountyId/submit
 * Allows the assigned developer to submit their work for a bounty.
 * Requires pr_url (validated URL). supporting_links and notes are optional.
 * Transitions the bounty status to 'in_review'.
 */
tasksRouter.post('/:bountyId/submit', ensureBountyAssignee('bountyId'), async (c) => {
    const bountyId = c.req.param('bountyId');

    // Verify bounty is in 'assigned' status
    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, bountyId),
        columns: { id: true, status: true },
    });

    if (!bounty) {
        return c.json({ error: 'Bounty not found' }, 404);
    }

    if (bounty.status !== 'assigned') {
        return c.json({ error: 'Bounty is not in the assigned state' }, 422);
    }

    const body = await c.req.json();
    const { pr_url, supporting_links, notes } = body;

    // Validate pr_url
    if (typeof pr_url !== 'string' || pr_url.trim() === '') {
        return c.json({ error: 'pr_url is required and must be a non-empty string' }, 400);
    }

    try {
        new URL(pr_url.trim());
    } catch {
        return c.json({ error: 'pr_url must be a valid URL' }, 400);
    }

    const user = c.get('user');
    const supportingLinks: string[] = Array.isArray(supporting_links) ? supporting_links : [];
    const notesStr: string | null = typeof notes === 'string' ? notes.trim() || null : null;

    const [created] = await db.insert(submissions).values({
        bountyId,
        developerId: user.id,
        prUrl: pr_url.trim(),
        supportingLinks,
        notes: notesStr,
        status: 'pending',
    }).returning({ id: submissions.id });

    await db.update(bounties)
        .set({ status: 'in_review', updatedAt: new Date() })
        .where(eq(bounties.id, bountyId));

    return c.json({
        success: true,
        submission_id: created.id,
        message: 'Work submitted for review',
    }, 201);
});

/**
 * POST /api/tasks/:bountyId/extend
 * Allows the assigned developer to request a deadline extension.
 * new_deadline is required (ISO 8601 string, must be in the future).
 * Enforces one active (pending) extension request per bounty per developer.
 */
tasksRouter.post('/:bountyId/extend', ensureBountyAssignee('bountyId'), async (c) => {
    const user = c.get('user');
    const bountyId = c.req.param('bountyId');

    const body = await c.req.json();
    const { new_deadline } = body;

    if (typeof new_deadline !== 'string' || new_deadline.trim() === '') {
        return c.json({ error: 'new_deadline is required (ISO 8601 datetime string)' }, 400);
    }

    const deadline = new Date(new_deadline);
    if (isNaN(deadline.getTime())) {
        return c.json({ error: 'new_deadline must be a valid date string' }, 400);
    }

    if (deadline <= new Date()) {
        return c.json({ error: 'new_deadline must be in the future' }, 400);
    }

    // Enforce one active (pending) request per bounty per developer via DB unique index
    try {
        const [created] = await db.insert(extensionRequests).values({
            bountyId,
            developerId: user.id,
            newDeadline: deadline,
            status: 'pending',
        }).returning({
            id: extensionRequests.id,
            bountyId: extensionRequests.bountyId,
            newDeadline: extensionRequests.newDeadline,
            status: extensionRequests.status,
            createdAt: extensionRequests.createdAt,
        });

        return c.json({
            id: created.id,
            bounty_id: created.bountyId,
            new_deadline: created.newDeadline,
            status: created.status,
            created_at: created.createdAt,
        }, 201);
    } catch (error: any) {
        if (error?.code === '23505') {
            return c.json({
                error: 'You already have a pending extension request for this bounty',
            }, 409);
        }
        throw error;
    }
});

export default tasksRouter;
