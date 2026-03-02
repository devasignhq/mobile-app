import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
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
                findMany: vi.fn(),
            },
        },
        select: vi.fn(),
    },
}));

const createSelectResultMock = <T>(rows: T[]) => ({
    from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
    }),
});

describe('GET /api/bounties/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();

        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 404 when bounty does not exist', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(null as never);

        const res = await app.request('/api/bounties/missing-id', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'Bounty not found' });
    });

    it('should return full bounty detail including creator, application count, and assignee', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-1',
            title: 'Test bounty',
            description: 'Test description',
            creatorId: 'creator-1',
            assigneeId: 'assignee-1',
            status: 'assigned',
        } as never);

        vi.mocked(db.select)
            .mockReturnValueOnce(createSelectResultMock([{ count: 3 }]) as never)
            .mockReturnValueOnce(createSelectResultMock([
                { id: 'creator-1', username: 'alice', avatarUrl: 'https://img/creator.png' },
                { id: 'assignee-1', username: 'bob', avatarUrl: 'https://img/assignee.png' },
            ]) as never);

        const res = await app.request('/api/bounties/bounty-1', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.id).toBe('bounty-1');
        expect(body.status).toBe('assigned');
        expect(body.applicationCount).toBe(3);
        expect(body.creator).toEqual({
            id: 'creator-1',
            username: 'alice',
            avatarUrl: 'https://img/creator.png',
        });
        expect(body.assignee).toEqual({
            id: 'assignee-1',
            username: 'bob',
            avatarUrl: 'https://img/assignee.png',
        });
        expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should return assignee as null when bounty is unassigned', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-2',
            title: 'Unassigned bounty',
            description: 'Test description',
            creatorId: 'creator-2',
            assigneeId: null,
            status: 'open',
        } as never);

        vi.mocked(db.select)
            .mockReturnValueOnce(createSelectResultMock([{ count: 0 }]) as never)
            .mockReturnValueOnce(createSelectResultMock([
                { id: 'creator-2', username: 'charlie', avatarUrl: null },
            ]) as never);

        const res = await app.request('/api/bounties/bounty-2', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.applicationCount).toBe(0);
        expect(body.creator).toEqual({
            id: 'creator-2',
            username: 'charlie',
            avatarUrl: null,
        });
        expect(body.assignee).toBeNull();
        expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should return 500 when the creator record is missing', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-3',
            title: 'Broken bounty',
            description: 'Test description',
            creatorId: 'creator-3',
            assigneeId: null,
            status: 'open',
        } as never);

        vi.mocked(db.select)
            .mockReturnValueOnce(createSelectResultMock([{ count: 1 }]) as never)
            .mockReturnValueOnce(createSelectResultMock([]) as never);

        const res = await app.request('/api/bounties/bounty-3', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Bounty creator not found' });
    });

    it('should return assignee as null when the assignee record is missing', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            id: 'bounty-4',
            title: 'Missing assignee',
            description: 'Test description',
            creatorId: 'creator-4',
            assigneeId: 'assignee-4',
            status: 'assigned',
        } as never);

        vi.mocked(db.select)
            .mockReturnValueOnce(createSelectResultMock([{ count: 2 }]) as never)
            .mockReturnValueOnce(createSelectResultMock([
                { id: 'creator-4', username: 'dana', avatarUrl: 'https://img/creator-4.png' },
            ]) as never);

        const res = await app.request('/api/bounties/bounty-4', {
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.creator).toEqual({
            id: 'creator-4',
            username: 'dana',
            avatarUrl: 'https://img/creator-4.png',
        });
        expect(body.assignee).toBeNull();
    });
});
