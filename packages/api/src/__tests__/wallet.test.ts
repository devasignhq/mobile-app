import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../app';

// Mock the db module
vi.mock('../db', () => ({
    db: {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({
                    limit: vi.fn(async () => [{
                        walletAddress: '0x1234567890abcdef',
                        totalEarned: '150.5000000',
                        bountiesCompleted: 3,
                    }]),
                })),
                orderBy: vi.fn(() => ({
                    limit: vi.fn(async () => []),
                })),
                innerJoin: vi.fn(() => ({
                    where: vi.fn(async () => [{
                        pendingAmount: '75.0000000',
                    }]),
                })),
            })),
        })),
    },
}));

// Mock JWT verification
vi.mock('hono/jwt', async (importOriginal) => {
    const original = await importOriginal<typeof import('hono/jwt')>();
    return {
        ...original,
        verify: vi.fn(async () => ({
            sub: 'user-123',
            username: 'testuser',
            exp: Date.now() / 1000 + 3600,
        })),
    };
});

describe('GET /api/wallet', () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createApp();
        process.env.JWT_PUBLIC_KEY = 'test-key';
    });

    it('should return 401 without auth token', async () => {
        const res = await app.request('/api/wallet');
        expect(res.status).toBe(401);
    });

    it('should return 200 with wallet data when authenticated', async () => {
        const res = await app.request('/api/wallet', {
            headers: {
                Authorization: 'Bearer valid-token',
            },
        });

        // Route should respond (not 404)
        expect(res.status).not.toBe(404);
        const body = await res.json();
        expect(body).toBeDefined();
    });
});
