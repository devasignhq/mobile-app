import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn(),
    },
}));

describe('GET /api/submissions/mine', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/submissions/mine', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer invalid.token'
            },
        });

        expect(res.status).toBe(401);
    });

    it('should fail with 400 for invalid pagination parameters', async () => {
        const res = await app.request('/api/submissions/mine?page=-1&limit=200', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(400);
    });

    it('should successfully return paginated submissions', async () => {
        const mockSubmissions = [
            { id: 's-1', prUrl: 'http://pr1', status: 'pending', createdAt: new Date('2026-03-19'), bounty: { id: 'b-1', title: 'Bounty 1' } },
            { id: 's-2', prUrl: 'http://pr2', status: 'approved', createdAt: new Date('2026-03-18'), bounty: { id: 'b-2', title: 'Bounty 2' } }
        ];

        // Mock the query chain
        const mockOffset = vi.fn().mockResolvedValue(mockSubmissions);
        const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
        const mockFrom1 = vi.fn().mockReturnValue({ innerJoin: mockJoin });

        const mockWhere2 = vi.fn().mockResolvedValue([{ count: 2 }]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        vi.mocked(db.select).mockImplementation((...args) => {
            // Check if it's the count query or the main query
            // The first select is the main query, second is count. We can differentiate by context inside the endpoint.
            // But an easier way is to just return a builder that handles both.
            // For simplicity, we just mock it to return an object that works for both.
            // When we do db.select({...}).from(...).innerJoin, it's the first query
            // When we do db.select({id: ...}).from(...).where, it's the second query.
            return {
                from: (table: any) => {
                    return {
                        innerJoin: mockJoin,
                        // This handles the totalCountResult query
                        where: mockWhere2,
                    };
                }
            } as any;
        });

        const res = await app.request('/api/submissions/mine?page=1&limit=10', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(2);
        expect(body.data[0].bounty.title).toBe('Bounty 1');
        expect(body.meta.total).toBe(2);
        expect(body.meta.page).toBe(1);
        expect(body.meta.limit).toBe(10);
        expect(body.meta.totalPages).toBe(1);
    });
});
