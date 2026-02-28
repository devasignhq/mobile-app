import { describe, it, expect, beforeEach, vi } from 'vitest';
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
        },
        transaction: vi.fn(),
    },
}));

describe('POST /api/tasks/:bountyId/submit', () => {
    const app = createApp();
    const insertValues = vi.fn();
    const insert = vi.fn();
    const updateWhere = vi.fn();
    const updateSet = vi.fn();
    const update = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\\nfake\\n-----END PUBLIC KEY-----';
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'test-user',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        insertValues.mockResolvedValue(undefined);
        insert.mockReturnValue({ values: insertValues });
        updateWhere.mockResolvedValue(undefined);
        updateSet.mockReturnValue({ where: updateWhere });
        update.mockReturnValue({ set: updateSet });
        vi.mocked(db.transaction).mockImplementation(async (callback: any) => {
            return callback({ insert, update });
        });
    });

    it('submits work and transitions bounty to in_review', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
        } as any);

        const res = await app.request('/api/tasks/bounty-1/submit', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pr_url: 'https://github.com/acme/repo/pull/123',
                supporting_links: ['https://example.com/demo'],
                notes: 'Ready for review',
            }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toBe('Work submitted for review');

        expect(db.query.bounties.findFirst).toHaveBeenCalledTimes(1);
        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            bountyId: 'bounty-1',
            developerId: 'test-user-id',
            prUrl: 'https://github.com/acme/repo/pull/123',
            supportingLinks: ['https://example.com/demo'],
            notes: 'Ready for review',
            status: 'pending',
        }));
        expect(update).toHaveBeenCalledTimes(1);
        expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
            status: 'in_review',
        }));
    });

    it('returns 400 when pr_url is missing', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
        } as any);

        const res = await app.request('/api/tasks/bounty-1/submit', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                supporting_links: ['https://example.com/demo'],
            }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('pr_url');
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it('returns 400 when supporting_links contains invalid URL', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
        } as any);

        const res = await app.request('/api/tasks/bounty-1/submit', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pr_url: 'https://github.com/acme/repo/pull/123',
                supporting_links: ['not-a-url'],
            }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('supporting_links');
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it('returns 403 when authenticated user is not bounty assignee', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'different-user-id',
        } as any);

        const res = await app.request('/api/tasks/bounty-1/submit', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pr_url: 'https://github.com/acme/repo/pull/123',
            }),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('assigned developer');
        expect(db.transaction).not.toHaveBeenCalled();
    });

    it('returns 401 when request is unauthenticated', async () => {
        const res = await app.request('/api/tasks/bounty-1/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pr_url: 'https://github.com/acme/repo/pull/123',
            }),
        });

        expect(res.status).toBe(401);
        expect(db.query.bounties.findFirst).not.toHaveBeenCalled();
        expect(db.transaction).not.toHaveBeenCalled();
    });
});
