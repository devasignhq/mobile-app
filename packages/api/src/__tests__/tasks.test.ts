import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn(),
        query: {
            bounties: { findMany: vi.fn() },
            users: { findFirst: vi.fn() },
        },
    },
}));

import { db } from '../db';

describe('GET /api/tasks', () => {
    let app: ReturnType<typeof createApp>;

    // Helper to build a chainable mock for db.select()
    function mockDbSelect(rows: any[]) {
        const chain = {
            from: vi.fn().mockReturnThis(),
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(rows),
        };
        vi.mocked(db.select).mockReturnValue(chain as any);
        return chain;
    }

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer invalid.token' },
        });

        expect(res.status).toBe(401);
    });

    it('should return empty groups when user has no assigned bounties', async () => {
        mockDbSelect([]);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta.total).toBe(0);
        expect(body.data.assigned).toEqual([]);
        expect(body.data.in_review).toEqual([]);
        expect(body.data.completed).toEqual([]);
        expect(body.data.open).toEqual([]);
        expect(body.data.cancelled).toEqual([]);
    });

    it('should group bounties by status', async () => {
        const rows = [
            {
                bounty: { id: 'b1', title: 'Task A', status: 'assigned', deadline: null },
                creator: { username: 'alice', avatarUrl: 'https://img/alice.png' },
                submission: { id: null, prUrl: null, status: null, createdAt: null },
            },
            {
                bounty: { id: 'b2', title: 'Task B', status: 'in_review', deadline: null },
                creator: { username: 'bob', avatarUrl: null },
                submission: { id: 's1', prUrl: 'https://github.com/pr/1', status: 'pending', createdAt: new Date() },
            },
            {
                bounty: { id: 'b3', title: 'Task C', status: 'assigned', deadline: new Date('2025-06-01') },
                creator: { username: 'alice', avatarUrl: 'https://img/alice.png' },
                submission: { id: null, prUrl: null, status: null, createdAt: null },
            },
        ];

        mockDbSelect(rows);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta.total).toBe(3);
        expect(body.data.assigned).toHaveLength(2);
        expect(body.data.in_review).toHaveLength(1);
        expect(body.data.completed).toHaveLength(0);
    });

    it('should include submission when present', async () => {
        const rows = [
            {
                bounty: { id: 'b1', title: 'Submitted Task', status: 'in_review', deadline: null },
                creator: { username: 'alice', avatarUrl: null },
                submission: { id: 's1', prUrl: 'https://github.com/pr/42', status: 'pending', createdAt: new Date() },
            },
        ];

        mockDbSelect(rows);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        const task = body.data.in_review[0];
        expect(task.submission).not.toBeNull();
        expect(task.submission.prUrl).toBe('https://github.com/pr/42');
        expect(task.submission.status).toBe('pending');
    });

    it('should set submission to null when no submission exists', async () => {
        const rows = [
            {
                bounty: { id: 'b1', title: 'No submission yet', status: 'assigned', deadline: null },
                creator: { username: 'charlie', avatarUrl: null },
                submission: { id: null, prUrl: null, status: null, createdAt: null },
            },
        ];

        mockDbSelect(rows);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        const task = body.data.assigned[0];
        expect(task.submission).toBeNull();
    });
});
