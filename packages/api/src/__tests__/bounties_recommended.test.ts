import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';
import { clearRecommendationsCacheForTests } from '../routes/bounties';

vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        query: {
            users: {
                findFirst: vi.fn(),
            },
            bounties: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('GET /api/bounties/recommended', () => {
    const app = createApp();

    beforeEach(() => {
        vi.clearAllMocks();
        clearRecommendationsCacheForTests();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'test-user',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('returns ranked recommendations with relevance scores', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'test-user-id',
            techStack: ['TypeScript', 'React', 'PostgreSQL'],
        } as any);

        vi.mocked(db.query.bounties.findMany).mockResolvedValue([
            {
                id: 'b1',
                title: 'Fullstack task',
                status: 'open',
                amountUsdc: '300',
                techTags: ['react', 'typescript'],
                createdAt: new Date('2026-01-01T00:00:00Z'),
            },
            {
                id: 'b2',
                title: 'Backend task',
                status: 'open',
                amountUsdc: '500',
                techTags: ['postgresql'],
                createdAt: new Date('2026-01-02T00:00:00Z'),
            },
            {
                id: 'b3',
                title: 'Unrelated task',
                status: 'open',
                amountUsdc: '1000',
                techTags: ['rust'],
                createdAt: new Date('2026-01-03T00:00:00Z'),
            },
        ] as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta.cached).toBe(false);
        expect(body.data).toHaveLength(3);
        expect(body.data[0].id).toBe('b1');
        expect(body.data[0].relevanceScore).toBeGreaterThan(0);
        expect(body.data[0].matchedTags).toEqual(expect.arrayContaining(['react', 'typescript']));
        expect(body.data[2].id).toBe('b3');
        expect(body.data[2].relevanceScore).toBe(0);
    });

    it('reuses cache for repeated requests from same user and tech stack', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'test-user-id',
            techStack: ['typescript'],
        } as any);

        vi.mocked(db.query.bounties.findMany).mockResolvedValue([
            {
                id: 'b1',
                title: 'TS task',
                status: 'open',
                amountUsdc: '42',
                techTags: ['typescript'],
                createdAt: new Date(),
            },
        ] as any);

        const first = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(first.status).toBe(200);
        expect(vi.mocked(db.query.bounties.findMany)).toHaveBeenCalledTimes(1);

        const second = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(second.status).toBe(200);

        const body = await second.json();
        expect(body.meta.cached).toBe(true);
        expect(vi.mocked(db.query.bounties.findMany)).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for invalid limit', async () => {
        const res = await app.request('/api/bounties/recommended?limit=0', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Invalid limit');
    });
});
