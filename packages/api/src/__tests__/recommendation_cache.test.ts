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
        execute: vi.fn(),
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

describe('Recommendation Cache', () => {
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

    it('falls back to in-memory cache when DB execute fails', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'test-user-id',
            techStack: ['typescript'],
        } as any);

        vi.mocked(db.query.bounties.findMany).mockResolvedValue([
            { id: 'b1', title: 'TS task', status: 'open', amountUsdc: '100', techTags: ['typescript'], createdAt: new Date() },
        ] as any);

        vi.mocked(db.execute).mockRejectedValue(new Error('DB connection failed'));

        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const first = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(first.status).toBe(200);
        expect(spy).toHaveBeenCalled();

        const second = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(second.status).toBe(200);
        const body = await second.json();
        expect(body.meta.cached).toBe(true);

        spy.mockRestore();
    });

    it('uses distributed cache when available', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'test-user-id',
            techStack: ['typescript'],
        } as any);

        vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] }); 
        vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] }); 
        vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] }); 

        vi.mocked(db.query.bounties.findMany).mockResolvedValue([
            { id: 'b1', title: 'TS task', status: 'open', amountUsdc: '100', techTags: ['typescript'], createdAt: new Date() },
        ] as any);

        vi.mocked(db.execute).mockResolvedValueOnce({ rows: [] });

        const first = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(first.status).toBe(200);
        
        vi.mocked(db.execute).mockResolvedValueOnce({ 
            rows: [{ 
                tech_key: 'typescript', 
                expires_at: new Date(Date.now() + 10000),
                payload: JSON.stringify([{ id: 'b1', relevanceScore: 100, matchedTags: ['typescript'] }])
            }] 
        });

        const second = await app.request('/api/bounties/recommended', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(second.status).toBe(200);
        const body = await second.json();
        expect(body.meta.cached).toBe(true);
        expect(body.data[0].id).toBe('b1');
    });
});