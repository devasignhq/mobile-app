import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions } from '../db/schema';

const tasksRouter = new Hono<{ Variables: Variables }>();

function isValidHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * POST /api/tasks/:bountyId/submit
 * Submits work for an assigned bounty and marks it as in_review.
 */
tasksRouter.post('/:bountyId/submit', async (c) => {
    const user = c.get('user');
    const bountyId = c.req.param('bountyId');

    const bounty = await db.query.bounties.findFirst({
        where: eq(bounties.id, bountyId),
        columns: {
            id: true,
            assigneeId: true,
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

    const payload = body as {
        pr_url?: unknown;
        supporting_links?: unknown;
        notes?: unknown;
    };

    if (typeof payload.pr_url !== 'string' || payload.pr_url.trim() === '') {
        return c.json({ error: 'pr_url is required and must be a non-empty string' }, 400);
    }

    const prUrl = payload.pr_url.trim();
    if (!isValidHttpUrl(prUrl)) {
        return c.json({ error: 'pr_url must be a valid http(s) URL' }, 400);
    }

    let supportingLinks: string[] | null = null;
    if (payload.supporting_links !== undefined) {
        if (!Array.isArray(payload.supporting_links)) {
            return c.json({ error: 'supporting_links must be an array of URLs' }, 400);
        }

        const normalizedLinks: string[] = [];
        for (const item of payload.supporting_links) {
            if (typeof item !== 'string' || item.trim() === '') {
                return c.json({ error: 'supporting_links must only contain non-empty strings' }, 400);
            }
            const normalized = item.trim();
            if (!isValidHttpUrl(normalized)) {
                return c.json({ error: 'supporting_links must only contain valid http(s) URLs' }, 400);
            }
            normalizedLinks.push(normalized);
        }

        supportingLinks = normalizedLinks;
    }

    let notes: string | null = null;
    if (payload.notes !== undefined) {
        if (typeof payload.notes !== 'string') {
            return c.json({ error: 'notes must be a string' }, 400);
        }
        notes = payload.notes.trim() || null;
    }

    await db.transaction(async (tx) => {
        await tx.insert(submissions).values({
            bountyId,
            developerId: user.id,
            prUrl,
            supportingLinks,
            notes,
            status: 'pending',
        });

        await tx.update(bounties)
            .set({
                status: 'in_review',
                updatedAt: new Date(),
            })
            .where(eq(bounties.id, bountyId));
    });

    return c.json({ success: true, message: 'Work submitted for review' });
});

/**
 * GET /api/tasks
 * Returns the authenticated user's assigned bounties grouped by status,
 * with bounty details, deadline, and submission status if work was submitted.
 */
tasksRouter.get('/', async (c) => {
    const user = c.get('user');

    const assignedBounties = await db.query.bounties.findMany({
        where: eq(bounties.assigneeId, user.id),
        columns: {
            id: true,
            title: true,
            status: true,
            amountUsdc: true,
            deadline: true,
            techTags: true,
        },
        orderBy: [desc(bounties.updatedAt)],
    });

    if (assignedBounties.length === 0) {
        return c.json({ data: {}, meta: { total: 0 } });
    }

    // Fetch submissions for these bounties in one query
    const bountyIds = assignedBounties.map(b => b.id);
    const mySubmissions = await db.query.submissions.findMany({
        where: (s, { and, inArray }) => and(
            eq(s.developerId, user.id),
            inArray(s.bountyId, bountyIds),
        ),
        columns: {
            bountyId: true,
            status: true,
            prUrl: true,
            createdAt: true,
        },
        orderBy: (s) => [desc(s.createdAt)],
    });

    // Index latest submission per bounty
    const submissionByBounty = new Map<string, typeof mySubmissions[number]>();
    for (const sub of mySubmissions) {
        if (!submissionByBounty.has(sub.bountyId)) {
            submissionByBounty.set(sub.bountyId, sub);
        }
    }

    // Group bounties by status
    const grouped: Record<string, object[]> = {};
    for (const bounty of assignedBounties) {
        const statusKey = bounty.status;
        if (!grouped[statusKey]) grouped[statusKey] = [];
        const submission = submissionByBounty.get(bounty.id);
        grouped[statusKey].push({
            id: bounty.id,
            title: bounty.title,
            amount_usdc: bounty.amountUsdc,
            deadline: bounty.deadline,
            tech_tags: bounty.techTags,
            submission: submission ? {
                status: submission.status,
                pr_url: submission.prUrl,
                submitted_at: submission.createdAt,
            } : null,
        });
    }

    return c.json({
        data: grouped,
        meta: { total: assignedBounties.length },
    });
});

export default tasksRouter;
