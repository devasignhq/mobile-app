import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => {
    const mockDb: any = {
        query: {
            bounties: { findFirst: vi.fn() },
        },
        insert: vi.fn(),
        update: vi.fn(),
        select: vi.fn(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockDb)),
    };
    return { db: mockDb };
});

const DEVELOPER_ID = 'user-uuid-dev';
const BOUNTY_ID = 'bounty-uuid-001';

const mockAssignedBounty = { id: BOUNTY_ID, status: 'assigned' };

function mockInsertChain(returnValue: any) {
    vi.mocked(db.insert).mockReturnValue({
        values: () => ({ returning: vi.fn().mockResolvedValue(returnValue) }),
    } as any);
}

function mockUpdateChain() {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as any);
}

function mockSelectChain(returnValue: any[]) {
    vi.mocked(db.select).mockReturnValue({
        from: () => ({
            where: () => ({
                limit: vi.fn().mockResolvedValue(returnValue),
            }),
        }),
    } as any);
}

describe('POST /api/tasks/:bountyId/submit', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should submit work and return 201 with submission_id', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]); // ensureBountyAssignee check
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockAssignedBounty as any);
        mockInsertChain([{ id: 'submission-new-001' }]);
        mockUpdateChain();

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/submit`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pr_url: 'https://github.com/example/repo/pull/42',
                supporting_links: ['https://example.com/docs'],
                notes: 'Implemented as discussed',
            }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.submission_id).toBe('submission-new-001');
    });

    it('should return 400 when pr_url is missing', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockAssignedBounty as any);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/submit`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'No PR yet' }),
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 when pr_url is not a valid URL', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockAssignedBounty as any);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/submit`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ pr_url: 'not-a-url' }),
        });
        expect(res.status).toBe(400);
    });

    it('should return 422 when bounty is not in assigned status', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({ id: BOUNTY_ID, status: 'in_review' } as any);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/submit`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ pr_url: 'https://github.com/example/repo/pull/42' }),
        });
        expect(res.status).toBe(422);
    });

    it('should return 403 when user is not the assignee', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([]); // no rows = not assignee

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/submit`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ pr_url: 'https://github.com/example/repo/pull/42' }),
        });
        expect(res.status).toBe(403);
    });
});
