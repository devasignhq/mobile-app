import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { ensureBountyCreator, ensureBountyAssignee } from '../middleware/resource-auth';
import { db } from '../db';
import { bounties, users } from '../db/schema';
import { eq, and, gte, lte, sql, desc, or, lt } from 'drizzle-orm';

const bountiesRouter = new Hono<{ Variables: Variables }>();
const RECOMMENDATION_CACHE_TTL_MS = 15 * 60 * 1000;
const RECOMMENDATION_POOL_SIZE = 200;
const USER_WEIGHT_MULTIPLIER = 2;
const MAX_SCORE_BASE_MULTIPLIER = 1 + USER_WEIGHT_MULTIPLIER;

type RecommendedBounty = typeof bounties.$inferSelect & {
    relevanceScore: number;
    matchedTags: string[];
};

type RecommendationCacheEntry = {
    expiresAt: number;
    techKey: string;
    data: RecommendedBounty[];
};

const recommendationsCache = new Map<string, RecommendationCacheEntry>();
let recommendationCacheTableReady = false;

function getDbExecute(): ((query: unknown) => Promise<unknown>) | null {
    const execute = (db as unknown as { execute?: (query: unknown) => Promise<unknown> }).execute;
    return typeof execute === 'function' ? execute : null;
}

async function ensureRecommendationCacheTable(): Promise<boolean> {
    const execute = getDbExecute();
    if (!execute) return false;
    if (recommendationCacheTableReady) return true;

    try {
        await execute(sql`
            CREATE TABLE IF NOT EXISTS recommendation_cache (
                cache_key TEXT PRIMARY KEY,
                tech_key TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                payload JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await execute(sql`
            CREATE INDEX IF NOT EXISTS recommendation_cache_expires_idx
            ON recommendation_cache (expires_at)
        `);
        recommendationCacheTableReady = true;
        return true;
     } catch (e) { console.error("Recommendation cache error:", e);
        return false;
    }
}

function rowFromExecuteResult(result: unknown): Record<string, unknown> | null {
    const rows = (result as { rows?: Record<string, unknown>[] } | null)?.rows;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function getCachedRecommendations(cacheKey: string, techKey: string, now: number): Promise<RecommendationCacheEntry | null> {
    const execute = getDbExecute();
    const supportsDistributedCache = execute && await ensureRecommendationCacheTable();

    if (supportsDistributedCache) {
        try {
            // Cache cleanup moved out of read path per performance review
            const result = await execute(sql`
                SELECT tech_key, expires_at, payload
                FROM recommendation_cache
                WHERE cache_key = ${cacheKey}
                LIMIT 1
            `);
            const row = rowFromExecuteResult(result);
            if (!row) return null;

            const expiresAtRaw = row.expires_at;
            const expiresAtMs = expiresAtRaw instanceof Date
                ? expiresAtRaw.getTime()
                : new Date(String(expiresAtRaw)).getTime();

            if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return null;
            if (String(row.tech_key ?? '') !== techKey) return null;

            const payload = row.payload as RecommendedBounty[] | string | undefined;
            const data = typeof payload === 'string'
                ? JSON.parse(payload) as RecommendedBounty[]
                : (payload ?? []);

            if (!Array.isArray(data)) return null;
            return {
                expiresAt: expiresAtMs,
                techKey,
                data,
            };
         } catch (e) { console.error("Recommendation cache error:", e);
            // Fall through to in-memory cache on any distributed-cache failure.
        }
    }

    clearExpiredRecommendationCache(now);
    const cached = recommendationsCache.get(cacheKey);
    if (!cached || cached.expiresAt <= now || cached.techKey !== techKey) {
        return null;
    }
    return cached;
}

async function setCachedRecommendations(cacheKey: string, entry: RecommendationCacheEntry): Promise<void> {
    const execute = getDbExecute();
    const supportsDistributedCache = execute && await ensureRecommendationCacheTable();

    if (supportsDistributedCache) {
        try {
            await execute(sql`
                INSERT INTO recommendation_cache (cache_key, tech_key, expires_at, payload, updated_at)
                VALUES (
                    ${cacheKey},
                    ${entry.techKey},
                    ${new Date(entry.expiresAt)},
                    ${JSON.stringify(entry.data)}::jsonb,
                    NOW()
                )
                ON CONFLICT (cache_key)
                DO UPDATE SET
                    tech_key = EXCLUDED.tech_key,
                    expires_at = EXCLUDED.expires_at,
                    payload = EXCLUDED.payload,
                    updated_at = NOW()
            `);
            return;
         } catch (e) { console.error("Recommendation cache error:", e);
            // Fall back to in-memory cache if distributed cache write fails.
        }
    }

    recommendationsCache.set(cacheKey, entry);
}

function normalizeTags(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    return input
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
}

function userTagWeights(userTags: string[]): Map<string, number> {
    const weights = new Map<string, number>();
    for (let i = 0; i < userTags.length; i++) {
        const tag = userTags[i];
        if (!weights.has(tag)) {
            // Earlier tags are weighted higher.
            weights.set(tag, 1 / (i + 1));
        }
    }
    return weights;
}

function scoreBounty(userWeights: Map<string, number>, bountyTags: string[]): { relevanceScore: number; matchedTags: string[] } {
    if (bountyTags.length === 0 || userWeights.size === 0) {
        return { relevanceScore: 0, matchedTags: [] };
    }

    let rawScore = 0;
    let maxScore = 0;
    const matchedTags: string[] = [];

    for (let i = 0; i < bountyTags.length; i++) {
        const tag = bountyTags[i];
        const tagWeight = 1 / (i + 1);
        maxScore += tagWeight * MAX_SCORE_BASE_MULTIPLIER;

        const userWeight = userWeights.get(tag);
        if (userWeight !== undefined) {
            matchedTags.push(tag);
            // Combines bounty-tag importance and user-tag importance.
            rawScore += tagWeight * (1 + userWeight * USER_WEIGHT_MULTIPLIER);
        }
    }

    const relevanceScore = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
    return { relevanceScore, matchedTags };
}

function clearExpiredRecommendationCache(now: number): void {
    for (const [key, entry] of recommendationsCache.entries()) {
        if (entry.expiresAt <= now) recommendationsCache.delete(key);
    }
}

// TODO: Add a separate out-of-band process (e.g. cron job) to periodically
// run: DELETE FROM recommendation_cache WHERE expires_at <= NOW();

export function clearRecommendationsCacheForTests(): void {
    recommendationsCache.clear();
    recommendationCacheTableReady = false;
}

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
 * Personalized bounty recommendations for authenticated user.
 */
bountiesRouter.get('/recommended', async (c) => {
    const user = c.get('user');
    const query = c.req.query();
    const limit = Math.min(parseInt(query.limit || '10'), 50);

    if (isNaN(limit) || limit < 1) {
        return c.json({ error: 'Invalid limit. Must be a positive integer.' }, 400);
    }

    const userProfile = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: {
            id: true,
            techStack: true,
        },
    });

    if (!userProfile) {
        return c.json({ error: 'User not found' }, 404);
    }

    const normalizedUserTags = normalizeTags(userProfile.techStack);
    const techKey = normalizedUserTags.join('|');
    const cacheKey = user.id;
    const now = Date.now();

    const cached = await getCachedRecommendations(cacheKey, techKey, now);
    if (cached) {
        return c.json({
            data: cached.data.slice(0, limit),
            meta: {
                count: Math.min(limit, cached.data.length),
                limit,
                cached: true,
                cache_ttl_seconds: Math.ceil((cached.expiresAt - now) / 1000),
            },
        });
    }

    const openBounties = await db.query.bounties.findMany({
        where: eq(bounties.status, 'open'),
        limit: RECOMMENDATION_POOL_SIZE,
        orderBy: [desc(bounties.createdAt)],
    });

    const weights = userTagWeights(normalizedUserTags);
    const ranked = openBounties
        .map((bounty) => {
            const bountyTags = normalizeTags(bounty.techTags);
            const scored = scoreBounty(weights, bountyTags);
            return {
                ...bounty,
                relevanceScore: scored.relevanceScore,
                matchedTags: scored.matchedTags,
            };
        })
        .sort((a, b) => {
            if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
            return Number(b.amountUsdc) - Number(a.amountUsdc);
        });

    await setCachedRecommendations(cacheKey, {
        expiresAt: now + RECOMMENDATION_CACHE_TTL_MS,
        techKey,
        data: ranked,
    });

    return c.json({
        data: ranked.slice(0, limit),
        meta: {
            count: Math.min(limit, ranked.length),
            limit,
            cached: false,
            cache_ttl_seconds: Math.floor(RECOMMENDATION_CACHE_TTL_MS / 1000),
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

export default bountiesRouter;
