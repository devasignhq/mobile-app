import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        query: {
            bounties: { findMany: vi.fn() },
            submissions: { findMany: vi.fn() },
        },
    },
}));

const TEST_USER_ID = 'user-uuid-001';

const mockBounty = {
    id: 'bounty-uuid-001',
    title: 'Fix auth bug',
    status: 'in_review',
    amountUsdc: '200',
    deadline: new Date('2026-04-01T00:00:00Z'),
    techTags: ['typescript'],
    updatedAt: new Date('2026-03-01T00:00:00Z'),
};

const mockSubmission = {
    bountyId: 'bounty-uuid-001',
    status: 'pending',
    prUrl: 'https://github.com/example/repo/pull/1',
    createdAt: new Date('2026-03-01T00:00:00Z'),
};

describe('GET /api/tasks', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
        vi.mocked(verify).mockResolvedValue({
            sub: TEST_USER_ID,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return assigned bounties grouped by status', async () => {
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([mockBounty] as any);
        vi.mocked(db.query.submissions.findMany).mockResolvedValue([mockSubmission] as any);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveProperty('in_review');
        expect(body.data.in_review).toHaveLength(1);
        expect(body.data.in_review[0].id).toBe('bounty-uuid-001');
        expect(body.data.in_review[0].submission).not.toBeNull();
        expect(body.data.in_review[0].submission.pr_url).toBe(mockSubmission.prUrl);
        expect(body.meta.total).toBe(1);
    });

    it('should return empty data when no assigned bounties', async () => {
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([]);
        vi.mocked(db.query.submissions.findMany).mockResolvedValue([]);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toEqual({});
        expect(body.meta.total).toBe(0);
    });

    it('should return null submission when no submission exists for a bounty', async () => {
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([mockBounty] as any);
        vi.mocked(db.query.submissions.findMany).mockResolvedValue([]);

        const res = await app.request('/api/tasks', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.in_review[0].submission).toBeNull();
    });

    it('should return 401 without auth token', async () => {
        const res = await app.request('/api/tasks');
        expect(res.status).toBe(401);
    });
});
