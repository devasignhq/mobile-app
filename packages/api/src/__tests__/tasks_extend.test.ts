import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        insert: vi.fn(),
        select: vi.fn(),
    },
}));

const DEVELOPER_ID = 'user-uuid-dev';
const BOUNTY_ID = 'bounty-uuid-001';

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function mockSelectChain(returnValue: any[]) {
    vi.mocked(db.select).mockReturnValue({
        from: () => ({
            where: () => ({
                limit: vi.fn().mockResolvedValue(returnValue),
            }),
        }),
    } as any);
}

const mockCreatedRequest = {
    id: 'ext-req-001',
    bountyId: BOUNTY_ID,
    newDeadline: new Date(FUTURE_DATE),
    status: 'pending',
    createdAt: new Date('2026-03-01T00:00:00Z'),
};

describe('POST /api/tasks/:bountyId/extend', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should create an extension request and return 201', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]); // ensureBountyAssignee check
        vi.mocked(db.insert).mockReturnValue({
            values: () => ({ returning: vi.fn().mockResolvedValue([mockCreatedRequest]) }),
        } as any);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_deadline: FUTURE_DATE }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe('ext-req-001');
        expect(body.status).toBe('pending');
        expect(body.bounty_id).toBe(BOUNTY_ID);
    });

    it('should return 400 when new_deadline is missing', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 when new_deadline is not a valid date', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_deadline: 'not-a-date' }),
        });
        expect(res.status).toBe(400);
    });

    it('should return 400 when new_deadline is in the past', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_deadline: '2020-01-01T00:00:00Z' }),
        });
        expect(res.status).toBe(400);
    });

    it('should return 409 when a pending extension request already exists', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([{ id: BOUNTY_ID }]);

        const uniqueViolation = Object.assign(
            new Error('duplicate key value violates unique constraint'),
            { code: '23505' },
        );
        vi.mocked(db.insert).mockReturnValue({
            values: () => ({ returning: vi.fn().mockRejectedValue(uniqueViolation) }),
        } as any);

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_deadline: FUTURE_DATE }),
        });
        expect(res.status).toBe(409);
    });

    it('should return 403 when user is not the assignee', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        mockSelectChain([]); // empty = not assignee

        const res = await app.request(`/api/tasks/${BOUNTY_ID}/extend`, {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_deadline: FUTURE_DATE }),
        });
        expect(res.status).toBe(403);
    });
});
