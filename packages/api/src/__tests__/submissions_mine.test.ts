import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        query: {
            submissions: { findMany: vi.fn() },
            bounties: { findMany: vi.fn() },
        },
    },
}));

const TEST_USER_ID = 'user-uuid-001';

const mockSubmission = {
    id: 'sub-uuid-001',
    bountyId: 'bounty-uuid-001',
    status: 'pending',
    prUrl: 'https://github.com/example/repo/pull/1',
    notes: 'Initial submission',
    createdAt: new Date('2026-03-01T00:00:00Z'),
};

const mockBounty = { id: 'bounty-uuid-001', title: 'Fix auth bug' };

describe('GET /api/submissions/mine', () => {
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

    it('should return paginated submissions with bounty title', async () => {
        vi.mocked(db.query.submissions.findMany).mockResolvedValue([mockSubmission] as any);
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([mockBounty] as any);

        const res = await app.request('/api/submissions/mine', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe('sub-uuid-001');
        expect(body.data[0].bounty_title).toBe('Fix auth bug');
        expect(body.data[0].status).toBe('pending');
        expect(body.meta.has_more).toBe(false);
        expect(body.meta.next_cursor).toBeNull();
    });

    it('should return empty list when no submissions', async () => {
        vi.mocked(db.query.submissions.findMany).mockResolvedValue([]);
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([]);

        const res = await app.request('/api/submissions/mine', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(0);
        expect(body.meta.count).toBe(0);
    });

    it('should paginate and set has_more with next_cursor', async () => {
        const twoSubs = [
            { ...mockSubmission, id: 'sub-1', createdAt: new Date('2026-03-02T00:00:00Z') },
            { ...mockSubmission, id: 'sub-2', createdAt: new Date('2026-03-01T00:00:00Z') },
        ];
        vi.mocked(db.query.submissions.findMany).mockResolvedValue(twoSubs as any);
        vi.mocked(db.query.bounties.findMany).mockResolvedValue([mockBounty] as any);

        const res = await app.request('/api/submissions/mine?limit=1', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(1);
        expect(body.meta.has_more).toBe(true);
        expect(body.meta.next_cursor).not.toBeNull();
    });

    it('should return 401 without auth', async () => {
        const res = await app.request('/api/submissions/mine');
        expect(res.status).toBe(401);
    });
});
