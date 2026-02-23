import { Hono } from 'hono';
import { verify } from 'hono/jwt';
import { db } from '../db';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const RECOMMENDATION_POOL_LIMIT = 200;
const RECOMMENDATION_CACHE_TTL_MS = 15 * 60 * 1000;
const RECOMMENDATION_CACHE_TTL_SECONDS = RECOMMENDATION_CACHE_TTL_MS / 1000;

type RecommendationCacheEntry = {
    expiresAt: number;
    generatedAt: string;
    data: Array<Record<string, unknown>>;
};

const recommendationCache = new Map<string, RecommendationCacheEntry>();

function parseLimit(raw: string | undefined): number | null {
    if (raw === undefined) {
        return DEFAULT_LIMIT;
    }

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        return null;
    }

    return parsed;
}

function getBearerToken(rawAuthorizationHeader: string | undefined): string | null {
    if (!rawAuthorizationHeader) {
        return null;
    }

    const [scheme, token] = rawAuthorizationHeader.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }

    return token.trim();
}

function normalizeTags(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const tags = new Set<string>();
    for (const value of raw) {
        if (typeof value !== 'string') {
            continue;
        }

        const normalized = value.trim().toLowerCase();
        if (normalized.length > 0) {
            tags.add(normalized);
        }
    }

    return [...tags];
}

function calculateRelevanceScore(userTechStack: string[], bountyTags: string[]): number {
    if (userTechStack.length === 0 || bountyTags.length === 0) {
        return 0;
    }

    const weights = new Map<string, number>();
    let maxScore = 0;

    for (let i = 0; i < userTechStack.length; i += 1) {
        const skill = userTechStack[i];
        const weight = Math.max(1, userTechStack.length - i);
        maxScore += weight;

        const existingWeight = weights.get(skill) ?? 0;
        if (weight > existingWeight) {
            weights.set(skill, weight);
        }
    }

    if (maxScore === 0) {
        return 0;
    }

    let score = 0;
    for (const tag of bountyTags) {
        const exactWeight = weights.get(tag);
        if (exactWeight !== undefined) {
            score += exactWeight;
            continue;
        }

        let partialWeight = 0;
        for (const [skill, weight] of weights.entries()) {
            if (skill.includes(tag) || tag.includes(skill)) {
                partialWeight = Math.max(partialWeight, weight * 0.5);
            }
        }
        score += partialWeight;
    }

    return Number(Math.min(score / maxScore, 1).toFixed(4));
}

const bountiesRoute = new Hono();

bountiesRoute.get('/recommended', async (c) => {
    const limit = parseLimit(c.req.query('limit'));
    if (limit === null) {
        return c.json({ error: `limit must be an integer between 1 and ${MAX_LIMIT}` }, 400);
    }

    const token = getBearerToken(c.req.header('Authorization'));
    if (!token) {
        return c.json({ error: 'Authorization bearer token is required' }, 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('GET /bounties/recommended failed: JWT_SECRET is missing');
        return c.json({ error: 'Internal server configuration error' }, 500);
    }

    let userId: string;
    try {
        const payload = await verify(token, secret, 'HS256');
        if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
            return c.json({ error: 'Invalid token payload' }, 401);
        }
        userId = payload.sub;
    } catch {
        return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const cacheKey = `${userId}:${limit}`;
    const now = Date.now();
    const cachedEntry = recommendationCache.get(cacheKey);

    if (cachedEntry && cachedEntry.expiresAt > now) {
        return c.json({
            data: cachedEntry.data,
            meta: {
                cached: true,
                generated_at: cachedEntry.generatedAt,
                ttl_seconds: RECOMMENDATION_CACHE_TTL_SECONDS,
            },
        });
    }

    if (cachedEntry) {
        recommendationCache.delete(cacheKey);
    }

    try {
        const user = await db.query.users.findFirst({
            columns: {
                techStack: true,
            },
            where: (table, { eq }) => eq(table.id, userId),
        });

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const userTechStack = normalizeTags(user.techStack);
        const generatedAt = new Date(now).toISOString();

        if (userTechStack.length === 0) {
            recommendationCache.set(cacheKey, {
                expiresAt: now + RECOMMENDATION_CACHE_TTL_MS,
                generatedAt,
                data: [],
            });

            return c.json({
                data: [],
                meta: {
                    cached: false,
                    generated_at: generatedAt,
                    ttl_seconds: RECOMMENDATION_CACHE_TTL_SECONDS,
                },
            });
        }

        const rows = await db.query.bounties.findMany({
            where: (table, { eq }) => eq(table.status, 'open'),
            orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
            limit: RECOMMENDATION_POOL_LIMIT,
        });

        const recommendations = rows
            .map((row) => ({
                ...row,
                relevanceScore: calculateRelevanceScore(userTechStack, normalizeTags(row.techTags)),
            }))
            .filter((row) => row.relevanceScore > 0)
            .sort((a, b) => {
                if (b.relevanceScore !== a.relevanceScore) {
                    return b.relevanceScore - a.relevanceScore;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
            .slice(0, limit);

        recommendationCache.set(cacheKey, {
            expiresAt: now + RECOMMENDATION_CACHE_TTL_MS,
            generatedAt,
            data: recommendations as Array<Record<string, unknown>>,
        });

        return c.json({
            data: recommendations,
            meta: {
                cached: false,
                generated_at: generatedAt,
                ttl_seconds: RECOMMENDATION_CACHE_TTL_SECONDS,
            },
        });
    } catch (error) {
        console.error('GET /bounties/recommended failed:', error);
        return c.json({ error: 'Failed to fetch recommended bounties' }, 500);
    }
});

export default bountiesRoute;
