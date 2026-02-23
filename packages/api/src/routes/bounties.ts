import { Hono } from 'hono';
import { and, eq, gte, lte, lt, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { difficultyEnum, statusEnum } from '../db/schema';

type Difficulty = (typeof difficultyEnum.enumValues)[number];
type BountyStatus = (typeof statusEnum.enumValues)[number];

type CursorPayload = {
    created_at: string;
    id: string;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const difficultyValues = new Set<Difficulty>(difficultyEnum.enumValues);
const statusValues = new Set<BountyStatus>(statusEnum.enumValues);

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

function parseAmount(raw: string | undefined): number | null {
    if (raw === undefined) {
        return null;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
}

function parseCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
    if (!raw) {
        return null;
    }

    try {
        const decoded = Buffer.from(raw, 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded) as Partial<CursorPayload>;
        if (typeof parsed.created_at !== 'string' || typeof parsed.id !== 'string') {
            return null;
        }

        const createdAt = new Date(parsed.created_at);
        if (Number.isNaN(createdAt.getTime())) {
            return null;
        }

        return { createdAt, id: parsed.id };
    } catch {
        return null;
    }
}

function encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(
        JSON.stringify({
            created_at: createdAt.toISOString(),
            id,
        }),
        'utf8',
    ).toString('base64url');
}

const bountiesRoute = new Hono();

bountiesRoute.get('/', async (c) => {
    const limit = parseLimit(c.req.query('limit'));
    if (limit === null) {
        return c.json({ error: `limit must be an integer between 1 and ${MAX_LIMIT}` }, 400);
    }

    const difficultyRaw = c.req.query('difficulty');
    let difficulty: Difficulty | undefined;
    if (difficultyRaw !== undefined) {
        if (!difficultyValues.has(difficultyRaw as Difficulty)) {
            return c.json({ error: `difficulty must be one of: ${difficultyEnum.enumValues.join(', ')}` }, 400);
        }
        difficulty = difficultyRaw as Difficulty;
    }

    const statusRaw = c.req.query('status');
    let status: BountyStatus | undefined;
    if (statusRaw !== undefined) {
        if (!statusValues.has(statusRaw as BountyStatus)) {
            return c.json({ error: `status must be one of: ${statusEnum.enumValues.join(', ')}` }, 400);
        }
        status = statusRaw as BountyStatus;
    }

    const amountMinRaw = c.req.query('amount_min') ?? c.req.query('min_amount');
    const amountMaxRaw = c.req.query('amount_max') ?? c.req.query('max_amount');
    const amountMin = parseAmount(amountMinRaw);
    const amountMax = parseAmount(amountMaxRaw);

    if (amountMinRaw !== undefined && amountMin === null) {
        return c.json({ error: 'amount_min must be a non-negative number' }, 400);
    }
    if (amountMaxRaw !== undefined && amountMax === null) {
        return c.json({ error: 'amount_max must be a non-negative number' }, 400);
    }
    if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
        return c.json({ error: 'amount_min cannot be greater than amount_max' }, 400);
    }

    const techStack = (c.req.query('tech_stack') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

    const cursorRaw = c.req.query('cursor');
    const cursor = parseCursor(cursorRaw);
    if (cursorRaw !== undefined && cursor === null) {
        return c.json({ error: 'cursor is invalid' }, 400);
    }

    try {
        const rows = await db.query.bounties.findMany({
            where: (table) => {
                const conditions: SQL<unknown>[] = [];

                if (difficulty !== undefined) {
                    conditions.push(eq(table.difficulty, difficulty));
                }
                if (status !== undefined) {
                    conditions.push(eq(table.status, status));
                }
                if (amountMin !== null) {
                    conditions.push(gte(table.amountUsdc, amountMin.toString()));
                }
                if (amountMax !== null) {
                    conditions.push(lte(table.amountUsdc, amountMax.toString()));
                }
                if (techStack.length > 0) {
                    conditions.push(sql`${table.techTags} @> ${JSON.stringify(techStack)}::jsonb`);
                }
                if (cursor !== null) {
                    const cursorCondition = or(
                        lt(table.createdAt, cursor.createdAt),
                        and(eq(table.createdAt, cursor.createdAt), lt(table.id, cursor.id)),
                    );
                    if (cursorCondition) {
                        conditions.push(cursorCondition);
                    }
                }

                if (conditions.length === 0) {
                    return undefined;
                }
                return and(...conditions);
            },
            orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
            limit: limit + 1,
        });

        const hasMore = rows.length > limit;
        const data = hasMore ? rows.slice(0, limit) : rows;
        const lastItem = data[data.length - 1];
        const lastCreatedAt =
            lastItem?.createdAt instanceof Date ? lastItem.createdAt : new Date(lastItem?.createdAt ?? '');
        const nextCursor =
            hasMore && lastItem && !Number.isNaN(lastCreatedAt.getTime())
                ? encodeCursor(lastCreatedAt, lastItem.id)
                : null;

        return c.json({
            data,
            meta: {
                next_cursor: nextCursor,
                has_more: hasMore,
            },
        });
    } catch (error) {
        console.error('GET /bounties failed:', error);
        return c.json({ error: 'Failed to fetch bounties' }, 500);
    }
});

export default bountiesRoute;
