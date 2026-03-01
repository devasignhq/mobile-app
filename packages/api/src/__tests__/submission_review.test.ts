import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        query: {
            submissions: { findFirst: vi.fn() },
            bounties: { findFirst: vi.fn() },
        },
        update: vi.fn(),
    },
}));

const DEVELOPER_ID = 'user-uuid-dev';
const CREATOR_ID = 'user-uuid-creator';
const SUB_ID = 'sub-uuid-001';
const BOUNTY_ID = 'bounty-uuid-001';

const mockPendingSubmission = {
    id: SUB_ID,
    bountyId: BOUNTY_ID,
    developerId: DEVELOPER_ID,
    status: 'pending',
};

const mockBounty = { id: BOUNTY_ID, creatorId: CREATOR_ID };

// Helper to mock db.update chain: db.update(...).set(...).where(...)
function mockUpdateChain() {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as any);
}

describe('POST /api/submissions/:id/approve', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should approve a pending submission (bounty creator)', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockPendingSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        mockUpdateChain();

        const res = await app.request(`/api/submissions/${SUB_ID}/approve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('should return 404 for unknown submission', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(undefined);

        const res = await app.request('/api/submissions/nonexistent/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(res.status).toBe(404);
    });

    it('should return 403 for non-creator user', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: 'other-user', username: 'other', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockPendingSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/approve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(res.status).toBe(403);
    });

    it('should return 422 when submission is not pending', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue({
            ...mockPendingSubmission,
            status: 'approved',
        } as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/approve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(res.status).toBe(422);
    });
});

describe('POST /api/submissions/:id/reject', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should reject a pending submission with a reason', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockPendingSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        mockUpdateChain();

        const res = await app.request(`/api/submissions/${SUB_ID}/reject`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'The PR does not meet the requirements' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('should return 400 when rejection_reason is missing', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockPendingSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/reject`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    it('should return 403 for non-creator', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockPendingSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/reject`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'Not good enough' }),
        });
        expect(res.status).toBe(403);
    });

    it('should return 422 when submission is not pending', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue({
            ...mockPendingSubmission,
            status: 'rejected',
        } as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/reject`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'Already rejected' }),
        });
        expect(res.status).toBe(422);
    });
});
