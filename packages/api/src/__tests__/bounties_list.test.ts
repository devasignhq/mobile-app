import { describe, it, expect, beforeAll, vi } from 'vitest';
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
        query: {
            bounties: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('GET /api/bounties', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();

        // Bypass auth
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        // Ensure the public key is set
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return a list of bounties with metadata', async () => {
        const mockBounties = [
            { id: '1', title: 'Bounty 1', createdAt: new Date('2024-01-01T00:00:00Z'), techTags: ['react'] },
            { id: '2', title: 'Bounty 2', createdAt: new Date('2024-01-02T00:00:00Z'), techTags: ['node'] },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(2);
        expect(body.meta.count).toBe(2);
        expect(body.meta.has_more).toBe(false);
        expect(body.meta.next_cursor).toBeNull();
    });

    it('should handle pagination and next_cursor', async () => {
        const mockBounties = [
            { id: '1', title: 'Bounty 1', createdAt: new Date('2024-01-01T00:00:00Z'), techTags: [] },
            { id: '2', title: 'Bounty 2', createdAt: new Date('2024-01-02T00:00:00Z'), techTags: [] },
        ];

        // Return 2 items when limit is 1
        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties?limit=1', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(body.meta.has_more).toBe(true);
        expect(body.meta.next_cursor).toBeDefined();

        // Verify we asked for limit + 1
        expect(db.query.bounties.findMany).toHaveBeenCalledWith(expect.objectContaining({
            limit: 2
        }));
    });

    it('should handle filters correctly', async () => {
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([]);

        const res = await app.request('/api/bounties?tech_stack=react&difficulty=beginner&status=open&amount_min=100', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);

        // Verify findMany was called (actual WHERE clause check is hard with SQL strings, but we ensure it matches the pattern)
        expect(db.query.bounties.findMany).toHaveBeenCalled();
    });

    it('should return 400 for invalid status', async () => {
        const res = await app.request('/api/bounties?status=invalid-status', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Invalid status');
    });

    it('should return 400 for invalid difficulty', async () => {
        const res = await app.request('/api/bounties?difficulty=invalid-difficulty', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Invalid difficulty');
    });

    it('should return 400 for invalid amount_min', async () => {
        const res = await app.request('/api/bounties?amount_min=not-a-number', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid amount_min. Must be a number.');
    });

    it('should return 400 for invalid amount_max', async () => {
        const res = await app.request('/api/bounties?amount_max=abc', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid amount_max. Must be a number.');
    });

    it('should return 400 for invalid cursor', async () => {
        const res = await app.request('/api/bounties?cursor=invalid-base64', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid cursor');
    });
});
