import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        query: {
            bounties: {
                findFirst: vi.fn(),
            },
            applications: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('GET /api/bounties/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();

        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('returns bounty detail with creator, application count, assignee, and status', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'b1',
            title: 'Fix API bug',
            status: 'assigned',
            creator: {
                id: 'u1',
                username: 'creator-user',
                avatarUrl: 'https://example.com/avatar.png',
            },
            assignee: {
                id: 'u2',
                username: 'assigned-user',
                avatarUrl: 'https://example.com/assigned.png',
            },
        } as any);

        vi.mocked(db.query.applications.findMany).mockResolvedValue([
            { id: 'a1' },
            { id: 'a2' },
        ] as any);

        const res = await app.request('/api/bounties/b1', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.id).toBe('b1');
        expect(body.status).toBe('assigned');
        expect(body.creator).toEqual({
            id: 'u1',
            username: 'creator-user',
            avatarUrl: 'https://example.com/avatar.png',
        });
        expect(body.assignee).toEqual({
            id: 'u2',
            username: 'assigned-user',
            avatarUrl: 'https://example.com/assigned.png',
        });
        expect(body.applicationCount).toBe(2);
    });

    it('returns 404 when bounty is not found', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(null as any);

        const res = await app.request('/api/bounties/missing', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });
});
