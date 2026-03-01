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
            disputes: { findFirst: vi.fn() },
        },
    },
}));

const DEVELOPER_ID = 'user-uuid-dev';
const CREATOR_ID = 'user-uuid-creator';
const SUB_ID = 'sub-uuid-001';
const BOUNTY_ID = 'bounty-uuid-001';

const mockSubmission = {
    id: SUB_ID,
    bountyId: BOUNTY_ID,
    developerId: DEVELOPER_ID,
    prUrl: 'https://github.com/example/repo/pull/1',
    supportingLinks: [],
    notes: null,
    status: 'pending',
    rejectionReason: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
};

const mockBounty = { id: BOUNTY_ID, creatorId: CREATOR_ID, title: 'Fix auth bug' };

describe('GET /api/submissions/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return submission detail for the submitter', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/submissions/${SUB_ID}`, {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(SUB_ID);
        expect(body.status).toBe('pending');
        expect(body.bounty_title).toBe('Fix auth bug');
        expect(body.dispute).toBeNull();
    });

    it('should return submission detail for the bounty creator', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: CREATOR_ID, username: 'creator', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/submissions/${SUB_ID}`, {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
    });

    it('should include dispute info when a dispute exists', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue({
            id: 'dispute-001', reason: 'Work not done', evidenceLinks: [], status: 'open',
            createdAt: new Date('2026-03-02T00:00:00Z'),
        } as any);

        const res = await app.request(`/api/submissions/${SUB_ID}`, {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.dispute).not.toBeNull();
        expect(body.dispute.status).toBe('open');
    });

    it('should return 404 for unknown submission', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(undefined);

        const res = await app.request('/api/submissions/nonexistent', {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(res.status).toBe(404);
    });

    it('should return 403 for unrelated user', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: 'other-user', username: 'other', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);

        const res = await app.request(`/api/submissions/${SUB_ID}`, {
            headers: { Authorization: 'Bearer valid.token' },
        });
        expect(res.status).toBe(403);
    });
});
