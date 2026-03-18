import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        query: {
            submissions: {
                findFirst: vi.fn(),
            },
            bounties: {
                findFirst: vi.fn(),
            },
            disputes: {
                findMany: vi.fn(),
            },
        },
    },
}));

import { db } from '../db';

describe('GET /api/submissions/mine', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        vi.mocked(verify).mockResolvedValue({
            sub: 'user-123',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return paginated list of user submissions', async () => {
        const mockSubmissions = [
            {
                id: 'sub-1',
                bountyId: 'bounty-1',
                bountyTitle: 'Fix login bug',
                status: 'pending',
                prUrl: 'https://github.com/org/repo/pull/1',
                createdAt: new Date('2026-03-01'),
                updatedAt: new Date('2026-03-01'),
            },
            {
                id: 'sub-2',
                bountyId: 'bounty-2',
                bountyTitle: 'Add dark mode',
                status: 'approved',
                prUrl: 'https://github.com/org/repo/pull/2',
                createdAt: new Date('2026-02-28'),
                updatedAt: new Date('2026-03-02'),
            },
        ];

        // Chain: select -> from -> innerJoin -> where -> orderBy -> limit -> offset -> returns mockSubmissions
        vi.mocked(db.select).mockReturnValue(db as any);
        vi.mocked(db.from).mockReturnValue(db as any);
        vi.mocked(db.innerJoin).mockReturnValue(db as any);
        vi.mocked(db.where).mockReturnValue(db as any);
        vi.mocked(db.orderBy).mockReturnValue(db as any);
        vi.mocked(db.limit).mockReturnValue(db as any);
        vi.mocked(db.offset).mockResolvedValue(mockSubmissions);

        const res = await app.request('/api/submissions/mine', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(2);
        expect(body.data[0].id).toBe('sub-1');
        expect(body.data[0].bountyTitle).toBe('Fix login bug');
        expect(body.data[1].status).toBe('approved');
        expect(body.meta.has_more).toBe(false);
    });

    it('should return 401 without auth', async () => {
        const res = await app.request('/api/submissions/mine');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/submissions/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        vi.mocked(verify).mockResolvedValue({
            sub: 'user-123',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return full submission details with disputes', async () => {
        const mockSubmission = {
            id: 'sub-1',
            bountyId: 'bounty-1',
            developerId: 'user-123',
            prUrl: 'https://github.com/org/repo/pull/1',
            supportingLinks: ['https://example.com/test'],
            notes: 'Fixed the issue',
            status: 'rejected',
            rejectionReason: 'Tests are missing',
            createdAt: new Date('2026-03-01'),
            updatedAt: new Date('2026-03-02'),
        };

        const mockBounty = {
            id: 'bounty-1',
            title: 'Fix login bug',
        };

        const mockDisputes = [
            {
                id: 'disp-1',
                reason: 'Tests were included in a separate commit',
                evidenceLinks: ['https://github.com/org/repo/commit/abc123'],
                status: 'open',
                createdAt: new Date('2026-03-03'),
                updatedAt: new Date('2026-03-03'),
            },
        ];

        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(mockSubmission as any);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBounty as any);
        vi.mocked(db.query.disputes.findMany).mockResolvedValue(mockDisputes as any);

        const res = await app.request('/api/submissions/sub-1', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe('sub-1');
        expect(body.bountyTitle).toBe('Fix login bug');
        expect(body.status).toBe('rejected');
        expect(body.rejectionReason).toBe('Tests are missing');
        expect(body.disputes).toHaveLength(1);
        expect(body.disputes[0].reason).toBe('Tests were included in a separate commit');
    });

    it('should return 404 if submission not found', async () => {
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue(undefined);

        const res = await app.request('/api/submissions/nonexistent', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Submission not found');
    });

    it('should return 403 if user does not own the submission', async () => {
        vi.mocked(db.query.submissions.findFirst).mockResolvedValue({
            id: 'sub-1',
            developerId: 'other-user',
            bountyId: 'bounty-1',
        } as any);

        const res = await app.request('/api/submissions/sub-1', {
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Forbidden');
    });

    it('should return 401 without auth', async () => {
        const res = await app.request('/api/submissions/sub-1');
        expect(res.status).toBe(401);
    });
});
