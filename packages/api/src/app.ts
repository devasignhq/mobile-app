import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { sql } from 'drizzle-orm';

export type DbLike = {
    execute: (query: any) => Promise<{ rows: any[] }>;
};

export type CreateAppDeps = {
    db: DbLike;
};

export function createApp(deps?: Partial<CreateAppDeps>) {
    const app = new Hono();

    app.use('*', logger());
    app.use('*', cors());

    app.use('*', async (_c, next) => {
        await next();
    });

    app.onError((err, c) => {
        console.error('App Error:', err);
        if (process.env.NODE_ENV === 'production') {
            return c.json({ error: 'Internal server error' }, 500);
        }
        return c.json({ error: 'Internal server error', message: err.message }, 500);
    });

    app.get('/health', (c) => c.json({ status: 'ok' }));

    app.post('/api/gemini', async (c) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('Gemini API key not configured on server');

        const body = await c.req.json();
        const { prompt } = body;

        if (typeof prompt !== 'string' || prompt.trim() === '') {
            return c.json({ error: 'Prompt is required and must be a non-empty string' }, 400);
        }

        console.log('Received prompt:', prompt);
        return c.json({ message: 'Request received securely on backend', status: 'success' });
    });

    // --- Bounties ---

    app.get('/bounties/:id', async (c) => {
        const bountyId = c.req.param('id');

        // Validate UUID to avoid DB errors for malformed inputs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(bountyId)) {
            return c.json({ error: 'Invalid bounty ID format' }, 400);
        }

        const db = deps?.db;
        if (!db) throw new Error('Database dependency not provided');

        const q = sql`
            SELECT
              b.id,
              b.github_issue_id,
              b.repo_owner,
              b.repo_name,
              b.title,
              b.description,
              b.amount_usdc,
              b.tech_tags,
              b.difficulty,
              b.status,
              b.deadline,
              b.creator_id,
              b.assignee_id,
              b.created_at,
              b.updated_at,
              creator.username AS creator_username,
              creator.avatar_url AS creator_avatar_url,
              assignee.username AS assignee_username,
              assignee.avatar_url AS assignee_avatar_url,
              (
                SELECT COUNT(*)::int
                FROM applications a
                WHERE a.bounty_id = b.id
              ) AS application_count
            FROM bounties b
            JOIN users creator ON creator.id = b.creator_id
            LEFT JOIN users assignee ON assignee.id = b.assignee_id
            WHERE b.id = ${bountyId}
            LIMIT 1;
        `;

        const result = await db.execute(q);
        const row = result.rows?.[0];

        if (!row) return c.json({ error: 'Bounty not found' }, 404);

        // Public response: omit internal user UUIDs
        return c.json({
            id: row.id,
            githubIssueId: row.github_issue_id,
            repoOwner: row.repo_owner,
            repoName: row.repo_name,
            title: row.title,
            description: row.description,
            amountUsdc: row.amount_usdc,
            techTags: row.tech_tags,
            difficulty: row.difficulty,
            status: row.status,
            deadline: row.deadline,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            creator: {
                username: row.creator_username,
                avatarUrl: row.creator_avatar_url,
            },
            applicationCount: row.application_count ?? 0,
            assignee: row.assignee_id
                ? {
                      username: row.assignee_username,
                      avatarUrl: row.assignee_avatar_url,
                  }
                : null,
        });
    });

    return app;
}
