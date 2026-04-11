import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        query: {
            bounties: {
                findMany: vi.fn(),
            },
            users: {
                findFirst: vi.fn(),
            }
        },
    },
}));

describe('GET /api/bounties/recommended', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer invalid.token'
            }
        });

        expect(res.status).toBe(401);
    });

    it('should sort bounties by weighted relevance score based on tech stack', async () => {
        const mockUser = { id: 'test-user-id', techStack: ['react', 'node'] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const date1 = new Date('2024-01-01T00:00:00Z');
        const date2 = new Date('2024-01-02T00:00:00Z');
        const date3 = new Date('2024-01-03T00:00:00Z');

        const mockBounties = [
            { id: '1', title: 'Bounty 1 (Zero matches)', techTags: ['python'], createdAt: date1 },
            { id: '2', title: 'Bounty 2 (Two matches)', techTags: ['react', 'node'], createdAt: date2 },
            { id: '3', title: 'Bounty 3 (One match)', techTags: ['react', 'svelte'], createdAt: date3 },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        // Bounty 2: coverage=2/2=1.0, depth=2/2=1.0 → score=1.0
        // Bounty 3: coverage=1/2=0.5, depth=1/2=0.5 → score=0.5
        // Bounty 1: coverage=0/1=0,   depth=0/2=0   → score=0
        expect(body.data).toHaveLength(3);
        expect(body.data[0].id).toBe('2');
        expect(body.data[0].relevanceScore).toBe(1);
        expect(body.data[1].id).toBe('3');
        expect(body.data[1].relevanceScore).toBe(0.5);
        expect(body.data[2].id).toBe('1');
        expect(body.data[2].relevanceScore).toBe(0);
    });

    it('should fall back to sorting by createdAt for identical relevance scores', async () => {
        const testUserId = 'test-user-id-3';
        vi.mocked(verify).mockResolvedValue({
            sub: testUserId,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const mockUser = { id: testUserId, techStack: ['react'] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const olderDate = new Date('2024-01-01T00:00:00Z');
        const newerDate = new Date('2024-01-02T00:00:00Z');

        const mockBounties = [
            { id: 'old', techTags: ['react'], createdAt: olderDate },
            { id: 'new', techTags: ['react'], createdAt: newerDate },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        // Both have same score, so the newer one comes first
        expect(body.data).toHaveLength(2);
        expect(body.data[0].id).toBe('new');
        expect(body.data[1].id).toBe('old');
        // Both should have equal relevance scores
        expect(body.data[0].relevanceScore).toBe(body.data[1].relevanceScore);
    });

    it('should match tech tags case-insensitively', async () => {
        const testUserId = 'test-user-id-case';
        vi.mocked(verify).mockResolvedValue({
            sub: testUserId,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const mockUser = { id: testUserId, techStack: ['React', 'TypeScript'] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const mockBounties = [
            { id: '1', techTags: ['react', 'typescript'], createdAt: new Date() },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(body.data[0].relevanceScore).toBe(1);
    });

    it('should return relevanceScore of 0 for bounties with no tech tags', async () => {
        const testUserId = 'test-user-id-notags';
        vi.mocked(verify).mockResolvedValue({
            sub: testUserId,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const mockUser = { id: testUserId, techStack: ['react'] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const mockBounties = [
            { id: '1', techTags: [], createdAt: new Date() },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(body.data[0].relevanceScore).toBe(0);
    });

    it('should return relevanceScore 0 when user has no tech stack', async () => {
        const testUserId = 'test-user-id-nostack';
        vi.mocked(verify).mockResolvedValue({
            sub: testUserId,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const mockUser = { id: testUserId, techStack: [] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const mockBounties = [
            { id: '1', techTags: ['react'], createdAt: new Date() },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        const res = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(body.data[0].relevanceScore).toBe(0);
    });

    it('should use cache on subsequent requests within TTL', async () => {
        // Change user id so the cache doesn't clash with previous tests since we use a global Map
        const testUserId = 'cache-test-user-id';
        vi.mocked(verify).mockResolvedValue({
            sub: testUserId,
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        const mockUser = { id: testUserId, techStack: ['python'] };
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser as any);

        const mockBounties = [
            { id: '1', techTags: ['python'], createdAt: new Date() },
        ];

        vi.mocked(db.query.bounties.findMany).mockResolvedValue(mockBounties as any);

        // First request populates cache
        const res1 = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });
        expect(res1.status).toBe(200);
        expect(db.query.users.findFirst).toHaveBeenCalledTimes(1);

        // Second request should hit cache
        const res2 = await app.request('/api/bounties/recommended', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });
        expect(res2.status).toBe(200);
        expect(db.query.users.findFirst).toHaveBeenCalledTimes(1); // Should not increase
    });
});
