import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        select: vi.fn(),
        transaction: vi.fn(),
    },
}));

describe('POST /api/disputes/:id/resolve', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verify).mockResolvedValue({
            sub: 'creator-user-id',
            id: 'creator-user-id',
            username: 'creatoruser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer invalid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 for invalid resolution type', async () => {
        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'invalid_type' })
        });

        expect(res.status).toBe(400);
    });

    it('should return 404 if dispute is not found', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Dispute not found');
    });

    it('should return 403 if user is not the bounty creator', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{
            dispute: { id: 'd-1', status: 'open' },
            submission: { id: 's-1' },
            bounty: { id: 'b-1', creatorId: 'different-user' }
        }]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(403);
    });

    it('should return 400 if dispute is already resolved or dismissed', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{
            dispute: { id: 'd-1', status: 'dismissed' },
            submission: { id: 's-1' },
            bounty: { id: 'b-1', creatorId: 'creator-user-id' }
        }]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(400);
    });

    it('should successfully resolve in favor of the developer', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{
            dispute: { id: 'd-1', status: 'open' },
            submission: { id: 's-1', developerId: 'dev-1' },
            bounty: { id: 'b-1', creatorId: 'creator-user-id', amountUsdc: '100.00' }
        }]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: 'd-1' }]);
        const mockUpdateWhere = vi.fn().mockImplementation(() => {
            const chainable = Promise.resolve([]);
            (chainable as any).returning = mockUpdateReturning;
            return chainable;
        });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        const mockInsertValues = vi.fn().mockResolvedValue([]);
        const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate,
                insert: mockInsert
            });
        });

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Dispute resolved successfully');
        
        // Ensure that transaction logic was called correctly (3 updates and 1 insert)
        expect(mockUpdate).toHaveBeenCalledTimes(3);
        expect(mockInsert).toHaveBeenCalledTimes(1);

        // First update: disputes status
        expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { status: 'resolved' });
        // Second update: submissions status
        expect(mockUpdateSet).toHaveBeenNthCalledWith(2, { status: 'approved' });
        // Third update: bounties status
        expect(mockUpdateSet).toHaveBeenNthCalledWith(3, { status: 'completed' });

        // Insert: transactions for payout
        expect(mockInsertValues).toHaveBeenCalledWith({
            userId: 'dev-1',
            type: 'bounty_payout',
            amountUsdc: '100.00',
            bountyId: 'b-1',
            status: 'pending'
        });

        vi.restoreAllMocks();
    });

    it('should successfully resolve in favor of the creator (dismiss the dispute)', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{
            dispute: { id: 'd-1', status: 'open' },
            submission: { id: 's-1', developerId: 'dev-1' },
            bounty: { id: 'b-1', creatorId: 'creator-user-id', amountUsdc: '100.00' }
        }]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: 'd-1' }]);
        const mockUpdateWhere = vi.fn().mockImplementation(() => {
            const chainable = Promise.resolve([]);
            (chainable as any).returning = mockUpdateReturning;
            return chainable;
        });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate
            });
        });

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_creator' })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Dispute resolved successfully');

        // Ensure that transaction logic was called correctly (2 updates)
        expect(mockUpdate).toHaveBeenCalledTimes(2);

        // First update: disputes status
        expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { status: 'dismissed' });
        // Second update: reopen bounty
        expect(mockUpdateSet).toHaveBeenNthCalledWith(2, { status: 'open', assigneeId: null });

        vi.restoreAllMocks();
    });

    it('should return 409 if dispute is modified concurrently', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{
            dispute: { id: 'd-1', status: 'open' },
            submission: { id: 's-1', developerId: 'dev-1' },
            bounty: { id: 'b-1', creatorId: 'creator-user-id', amountUsdc: '100.00' }
        }]);
        const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockWhere });
        const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const mockUpdateReturning = vi.fn().mockResolvedValue([]); // Simulate 0 rows updated
        const mockUpdateWhere = vi.fn().mockImplementation(() => {
            const chainable = Promise.resolve([]);
            (chainable as any).returning = mockUpdateReturning;
            return chainable;
        });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate,
                rollback: () => { throw new Error('Rollback'); }
            });
        });

        const res = await app.request('/api/disputes/123e4567-e89b-12d3-a456-426614174000/resolve', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ resolution: 'resolved_developer' })
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('Failed to resolve dispute or records were modified concurrently');
    });
});
