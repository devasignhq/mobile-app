import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        query: {
            submissions: { findFirst: vi.fn() },
            disputes: { findFirst: vi.fn() },
        },
        insert: vi.fn(),
    },
}));

const DEVELOPER_ID = 'user-uuid-dev';
const SUB_ID = 'sub-uuid-001';

const mockRejectedSubmission = {
    id: SUB_ID,
    developerId: DEVELOPER_ID,
    status: 'rejected',
};

const mockCreatedDispute = {
    id: 'dispute-new-001',
    submissionId: SUB_ID,
    reason: 'Work was completed as specified',
    evidenceLinks: ['https://example.com/evidence'],
    status: 'open',
    createdAt: new Date('2026-03-01T00:00:00Z'),
};

describe('POST /api/submissions/:id/dispute', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should create a dispute for a rejected submission', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockRejectedSubmission as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);
        vi.mocked(db.insert).mockReturnValue({
            values: () => ({ returning: vi.fn().mockResolvedValue([mockCreatedDispute]) }),
        } as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/dispute`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Work was completed as specified', evidence_links: ['https://example.com/evidence'] }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe('dispute-new-001');
        expect(body.status).toBe('open');
        expect(body.reason).toBe('Work was completed as specified');
        expect(body.evidence_links).toEqual(['https://example.com/evidence']);
    });

    it('should return 404 for unknown submission', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(undefined);

        const res = await app.request('/api/submissions/nonexistent/dispute', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'My work was done' }),
        });
        expect(res.status).toBe(404);
    });

    it('should return 403 for a user who does not own the submission', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: 'other-user', username: 'other', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockRejectedSubmission as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/dispute`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'My work was done' }),
        });
        expect(res.status).toBe(403);
    });

    it('should return 422 when submission is not rejected', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue({
            ...mockRejectedSubmission,
            status: 'pending',
        } as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/dispute`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'My work was done' }),
        });
        expect(res.status).toBe(422);
    });

    it('should return 409 when a dispute already exists', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockRejectedSubmission as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue({ id: 'existing-dispute' } as any);

        const res = await app.request(`/api/submissions/${SUB_ID}/dispute`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'My work was done' }),
        });
        expect(res.status).toBe(409);
    });

    it('should return 400 when reason is missing', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockRejectedSubmission as any);
        vi.mocked(db.query.disputes.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/submissions/${SUB_ID}/dispute`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence_links: [] }),
        });
        expect(res.status).toBe(400);
    });
});
