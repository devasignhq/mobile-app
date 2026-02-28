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
            extensionRequests: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(),
    },
}));

describe('POST /api/tasks/:bountyId/extend', () => {
    const app = createApp();
    const insertValues = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\\nfake\\n-----END PUBLIC KEY-----';
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'test-user',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        insertValues.mockResolvedValue(undefined);
        vi.mocked(db.insert).mockReturnValue({ values: insertValues } as any);
    });

    it('creates a pending extension request for assigned developer', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
            deadline: new Date('2026-03-01T00:00:00Z'),
        } as any);
        vi.mocked(db.query.extensionRequests.findFirst).mockResolvedValue(undefined as any);

        const res = await app.request('/api/tasks/bounty-1/extend', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_deadline: '2026-03-10T00:00:00Z',
            }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toBe('Extension request submitted');

        expect(db.query.extensionRequests.findFirst).toHaveBeenCalledTimes(1);
        expect(db.insert).toHaveBeenCalledTimes(1);
        expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
            bountyId: 'bounty-1',
            developerId: 'test-user-id',
            status: 'pending',
        }));
    });

    it('returns 400 when new_deadline is missing', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
            deadline: new Date('2026-03-01T00:00:00Z'),
        } as any);

        const res = await app.request('/api/tasks/bounty-1/extend', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('new_deadline');
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not assigned developer', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'other-user-id',
            deadline: new Date('2026-03-01T00:00:00Z'),
        } as any);

        const res = await app.request('/api/tasks/bounty-1/extend', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_deadline: '2026-03-10T00:00:00Z',
            }),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('assigned developer');
        expect(db.query.extensionRequests.findFirst).not.toHaveBeenCalled();
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('returns 409 when there is already an active pending request on the bounty', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            assigneeId: 'test-user-id',
            deadline: new Date('2026-03-01T00:00:00Z'),
        } as any);
        vi.mocked(db.query.extensionRequests.findFirst).mockResolvedValue({
            id: 'existing-request-id',
        } as any);

        const res = await app.request('/api/tasks/bounty-1/extend', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_deadline: '2026-03-10T00:00:00Z',
            }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toContain('active extension request');
        expect(db.insert).not.toHaveBeenCalled();
    });

    it('returns 401 when request is unauthenticated', async () => {
        const res = await app.request('/api/tasks/bounty-1/extend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_deadline: '2026-03-10T00:00:00Z',
            }),
        });

        expect(res.status).toBe(401);
        expect(db.query.bounties.findFirst).not.toHaveBeenCalled();
        expect(db.insert).not.toHaveBeenCalled();
    });
});
