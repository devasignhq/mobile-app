/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

// Hoist mock for StellarClient
const { mockGetUsdcBalance } = vi.hoisted(() => ({
    mockGetUsdcBalance: vi.fn(),
}));

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn(),
    },
}));

// Mock StellarClient
vi.mock('../services/stellar', () => ({
    StellarClient: vi.fn(function () {
        return {
            getUsdcBalance: mockGetUsdcBalance,
        };
    }),
}));

describe('GET /api/wallet', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
        process.env.USDC_ASSET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
        process.env.STELLAR_NETWORK = 'TESTNET';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        // Default: getUsdcBalance returns a balance
        mockGetUsdcBalance.mockResolvedValue('100.0000000');
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer invalid.token',
            },
        });

        expect(res.status).toBe(401);
    });

    it('should return balance and pending earnings for a user with a wallet', async () => {
        // First db.select() -> user record with wallet
        const mockUserWhere = vi.fn().mockResolvedValue([{ walletAddress: 'GABCDEF123456' }]);
        const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

        // Second db.select() -> pending earnings sum
        const mockPendingWhere = vi.fn().mockResolvedValue([{ total: '250.0000000' }]);
        const mockPendingInnerJoin = vi.fn().mockReturnValue({ where: mockPendingWhere });
        const mockPendingFrom = vi.fn().mockReturnValue({ innerJoin: mockPendingInnerJoin });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockUserFrom } as any)
            .mockReturnValueOnce({ from: mockPendingFrom } as any);

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.walletAddress).toBe('GABCDEF123456');
        expect(body.data.balanceUsdc).toBe('100.0000000');
        expect(body.data.pendingEarningsUsdc).toBe('250.0000000');
    });

    it('should return "0" balance when user has no wallet provisioned', async () => {
        // User record with no wallet
        const mockUserWhere = vi.fn().mockResolvedValue([{ walletAddress: null }]);
        const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

        // Pending earnings: none
        const mockPendingWhere = vi.fn().mockResolvedValue([{ total: null }]);
        const mockPendingInnerJoin = vi.fn().mockReturnValue({ where: mockPendingWhere });
        const mockPendingFrom = vi.fn().mockReturnValue({ innerJoin: mockPendingInnerJoin });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockUserFrom } as any)
            .mockReturnValueOnce({ from: mockPendingFrom } as any);

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.walletAddress).toBeNull();
        expect(body.data.balanceUsdc).toBe('0');
        expect(body.data.pendingEarningsUsdc).toBe('0');

        // Should NOT have called StellarClient since wallet is null
        expect(mockGetUsdcBalance).not.toHaveBeenCalled();
    });

    it('should return "0" pending earnings when no submissions are pending', async () => {
        const mockUserWhere = vi.fn().mockResolvedValue([{ walletAddress: 'GABCDEF123456' }]);
        const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

        // Pending earnings: sum returns null (no rows)
        const mockPendingWhere = vi.fn().mockResolvedValue([{ total: null }]);
        const mockPendingInnerJoin = vi.fn().mockReturnValue({ where: mockPendingWhere });
        const mockPendingFrom = vi.fn().mockReturnValue({ innerJoin: mockPendingInnerJoin });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockUserFrom } as any)
            .mockReturnValueOnce({ from: mockPendingFrom } as any);

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.balanceUsdc).toBe('100.0000000');
        expect(body.data.pendingEarningsUsdc).toBe('0');
    });

    it('should return 502 when Stellar network fails', async () => {
        const mockUserWhere = vi.fn().mockResolvedValue([{ walletAddress: 'GABCDEF123456' }]);
        const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

        // Pending earnings query (fires concurrently)
        const mockPendingWhere = vi.fn().mockResolvedValue([{ total: '50.0000000' }]);
        const mockPendingInnerJoin = vi.fn().mockReturnValue({ where: mockPendingWhere });
        const mockPendingFrom = vi.fn().mockReturnValue({ innerJoin: mockPendingInnerJoin });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockUserFrom } as any)
            .mockReturnValueOnce({ from: mockPendingFrom } as any);

        mockGetUsdcBalance.mockRejectedValue(new Error('Network timeout'));

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toBe('Failed to fetch balance from Stellar network');
    });

    it('should return 404 if user record not found', async () => {
        const mockUserWhere = vi.fn().mockResolvedValue([]);
        const mockUserFrom = vi.fn().mockReturnValue({ where: mockUserWhere });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockUserFrom } as any);

        const res = await app.request('/api/wallet', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token',
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('User not found');
    });
});
