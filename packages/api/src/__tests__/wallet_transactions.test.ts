import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

const { mockWhere, mockOffset } = vi.hoisted(() => ({
    mockWhere: vi.fn(),
    mockOffset: vi.fn()
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: mockWhere,
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: mockOffset,
    },
}));

describe('GET /api/wallet/transactions', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return 401 if unauthorized', async () => {
        const res = await app.request('/api/wallet/transactions');
        expect(res.status).toBe(401);
    });

    it('should return paginated transactions for the authenticated user', async () => {
        vi.mocked(verify).mockResolvedValue({
            sub: 'user123',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        // First query (count) ends at .where()
        mockWhere.mockImplementationOnce(() => Promise.resolve([{ count: 15 }]));
        
        // Second query (history) continues chain from .where() -> .orderBy() -> .limit() -> .offset()
        // Here we make .where() continue the chain by returning 'this' (the mocked db object)
        mockWhere.mockImplementationOnce(function(this: any) { return this; });
        
        // The final method in the history query chain is .offset()
        mockOffset.mockResolvedValueOnce([ 
            {
                id: 'tx1',
                type: 'bounty_payout',
                amount: '100.00',
                bountyId: 'bounty1',
                bountyTitle: 'Test Bounty',
                stellarTxHash: 'hash123',
                status: 'completed',
                timestamp: '2023-01-01T00:00:00.000Z'
            }
        ]);

        const res = await app.request('/api/wallet/transactions?page=2&limit=10', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe('tx1');
        expect(body.data[0].bountyTitle).toBe('Test Bounty');
        expect(body.meta).toEqual({
            page: 2,
            limit: 10,
            total: 15,
            totalPages: 2
        });
    });

    it('should return 400 for invalid pagination parameters', async () => {
        vi.mocked(verify).mockResolvedValue({
            sub: 'user123',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const res = await app.request('/api/wallet/transactions?page=-1', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid pagination parameters');
    });
});
