import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => {
    const mockDb: any = {
        query: {
            disputes: { findFirst: vi.fn() },
            submissions: { findFirst: vi.fn() },
            bounties: { findFirst: vi.fn() },
        },
        update: vi.fn(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockDb)),
    };
    return { db: mockDb };
});

const DEVELOPER_ID = 'user-uuid-dev';
const CREATOR_ID = 'user-uuid-creator';
const SUB_ID = 'sub-uuid-001';
const BOUNTY_ID = 'bounty-uuid-001';
const DISPUTE_ID = 'dispute-uuid-001';

const mockOpenDispute = { id: DISPUTE_ID, submissionId: SUB_ID, status: 'open' };
const mockSubmission = { id: SUB_ID, bountyId: BOUNTY_ID, developerId: DEVELOPER_ID };
const mockBounty = { id: BOUNTY_ID, creatorId: CREATOR_ID };

function mockUpdateChain() {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as any);
}

describe('POST /api/disputes/:id/resolve', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should resolve dispute in favour of the developer', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(mockOpenDispute as any);
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        mockUpdateChain();

        const res = await app.request(`/api/disputes/${DISPUTE_ID}/resolve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'resolved_developer' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain('developer');
    });

    it('should resolve dispute in favour of the creator (reopen bounty)', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(mockOpenDispute as any);
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        mockUpdateChain();

        const res = await app.request(`/api/disputes/${DISPUTE_ID}/resolve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'resolved_creator' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain('reopened');
    });

    it('should return 404 for unknown dispute', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

        const res = await app.request('/api/disputes/nonexistent/resolve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'resolved_developer' }),
        });
        expect(res.status).toBe(404);
    });

    it('should return 422 when dispute is already resolved', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue({
            ...mockOpenDispute,
            status: 'resolved',
        } as any);

        const res = await app.request(`/api/disputes/${DISPUTE_ID}/resolve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'resolved_developer' }),
        });
        expect(res.status).toBe(422);
    });

    it('should return 403 for non-creator', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: 'other-user', username: 'other', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(mockOpenDispute as any);
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/disputes/${DISPUTE_ID}/resolve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'resolved_developer' }),
        });
        expect(res.status).toBe(403);
    });

    it('should return 400 for invalid resolution value', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(mockOpenDispute as any);
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/disputes/${DISPUTE_ID}/resolve`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution: 'invalid_value' }),
        });
        expect(res.status).toBe(400);
    });
});
