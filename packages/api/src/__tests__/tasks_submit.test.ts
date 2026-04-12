import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';
import { BountyNotFoundError, InvalidBountyStatusError } from '../utils/errors';
import { githubService } from '../services/github';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock githubService
vi.mock('../services/github', () => ({
    githubService: {
        getPRDetails: vi.fn(),
    },
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        transaction: vi.fn(),
        query: {
            bounties: { findFirst: vi.fn() },
        },
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

// Mock the middleware resource auth
vi.mock('../middleware/resource-auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../middleware/resource-auth')>();
    return {
        ...actual,
        ensureBountyAssignee: (_paramName: string) => async (c: any, next: any) => {
            const user = c.get('user');
            if (!user) return c.json({ error: 'Unauthorized' }, 401);
            // Simulate success for tests unless we specifically mock it to fail
            await next();
        },
    };
});

describe('POST /api/tasks/:id/submit', () => {
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
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        // Default valid mock for db.query.bounties.findFirst
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({ 
            id: 'b-123', 
            status: 'assigned',
            repoOwner: 'foo',
            repoName: 'bar'
        });

        // Default mock for githubService.getPRDetails
        vi.mocked(githubService.getPRDetails).mockResolvedValue({
            user: { login: 'testuser' },
        });
    });

    it('should return 400 if validation fails (invalid URL format using schema)', async () => {
        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'not-a-url' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
    });

    it('should return 400 if PR url is in invalid GitHub format', async () => {
        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/issues/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid GitHub PR URL format');
    });

    it('should return 400 if PR is not for the correct repository', async () => {
        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/wrong/repo/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('PR does not belong to the correct repository for this bounty');
    });

    it('should return 400 if PR does not exist on GitHub', async () => {
        vi.mocked(githubService.getPRDetails).mockResolvedValue(null);

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Pull Request not found on GitHub');
    });

    it('should return 400 if PR is not authored by the submitting user', async () => {
        vi.mocked(githubService.getPRDetails).mockResolvedValue({
            user: { login: 'anotheruser' }
        });

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('You are not the author of this Pull Request');
    });

    it('should return 404 if bounty is not found', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(null);

        const res = await app.request('/api/tasks/b-nonexistent/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });

    it('should return 400 if bounty status is not assigned', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({ id: 'b-123', status: 'open', repoOwner: 'foo', repoName: 'bar' });

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Cannot submit work for bounty with status: open');
    });

    it('should successfuly submit work and update status (URL with hash)', async () => {
        const mockSubmission = { id: 's-456', prUrl: 'https://github.com/foo/bar/pull/1#issue-123' };

        vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
            const txMock = {
                query: {
                    bounties: {
                        findFirst: vi.fn().mockResolvedValue({ id: 'b-123', status: 'assigned' }),
                    },
                },
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockSubmission]),
                    }),
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue({}),
                    }),
                }),
            };
            return cb(txMock);
        });

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({
                pr_url: 'https://github.com/foo/bar/pull/1#issue-123',
                supporting_links: ['https://demo.com'],
                notes: 'Finished the task'
            }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.prUrl).toBe(mockSubmission.prUrl);
    });

    it('should successfuly submit work and update status', async () => {
        const mockSubmission = { id: 's-456', prUrl: 'https://github.com/foo/bar/pull/1' };

        vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
            const txMock = {
                query: {
                    bounties: {
                        findFirst: vi.fn().mockResolvedValue({ id: 'b-123', status: 'assigned' }),
                    },
                },
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockSubmission]),
                    }),
                }),
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue({}),
                    }),
                }),
            };
            return cb(txMock);
        });

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({
                pr_url: 'https://github.com/foo/bar/pull/1',
                supporting_links: ['https://demo.com'],
                notes: 'Finished the task'
            }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.prUrl).toBe(mockSubmission.prUrl);
    });

    it('should return 409 if a submission for the bounty already exists', async () => {
        const duplicateError = new Error('duplicate key value') as any;
        duplicateError.code = '23505';

        vi.mocked(db.transaction).mockRejectedValue(duplicateError);

        const res = await app.request('/api/tasks/b-123/submit', {
            method: 'POST',
            body: JSON.stringify({ pr_url: 'https://github.com/foo/bar/pull/1' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('A submission for this bounty already exists.');
    });
});
