import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

const { mockWhere } = vi.hoisted(() => ({
    mockWhere: vi.fn()
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: mockWhere,
        query: {
            bounties: {
                findMany: vi.fn(),
            },
        },
    },
}));

describe('GET /api/bounties/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();

        // Bypass auth
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        // Ensure the public key is set
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return full bounty details including creator, assignee, and application count', async () => {
        const mockBountyResult = {
            bounty: { id: 'bounty123', title: 'Test Bounty', creatorId: 'creator1', assigneeId: 'assignee1' },
            creator: { username: 'creator1', avatarUrl: 'http://avatar1.com' },
            assignee: { username: 'assignee1', avatarUrl: 'http://avatar2.com' }
        };

        const mockCountResult = { count: 3 };

        // We expect two queries using db.where
        mockWhere
            .mockResolvedValueOnce([mockBountyResult])
            .mockResolvedValueOnce([mockCountResult]);

        const res = await app.request('/api/bounties/bounty123', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.id).toBe('bounty123');
        expect(body.title).toBe('Test Bounty');
        expect(body.creator.username).toBe('creator1');
        expect(body.creator.avatarUrl).toBe('http://avatar1.com');
        expect(body.assignee.username).toBe('assignee1');
        expect(body.assignee.avatarUrl).toBe('http://avatar2.com');
        expect(body.applicationCount).toBe(3);
    });

    it('should return 404 if bounty not found', async () => {
        // First query returns empty array
        mockWhere.mockResolvedValueOnce([]);

        const res = await app.request('/api/bounties/nonexistent', {
            headers: {
                'Authorization': 'Bearer valid.token'
            }
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });
});
