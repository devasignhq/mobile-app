import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { githubService } from '../services/github';
import { db } from '../db';
import * as jwt from 'hono/jwt';

// Mock dependencies
vi.mock('../services/github', () => ({
    githubService: {
        getUserProfileByUsername: vi.fn(),
    },
}));

vi.mock('../db', () => ({
    db: {
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: vi.fn(() => [{
                        avatarUrl: 'https://synced.avatar.url',
                        email: 'test@example.com',
                        publicRepos: 42
                    }])
                })),
            })),
        })),
    },
}));

vi.mock('hono/jwt', async (importOriginal) => {
    const original = await importOriginal<typeof import('hono/jwt')>();
    return {
        ...original,
        verify: vi.fn(), // We'll set this up in tests
    };
});

describe('Users Routes (Sync Profile)', () => {
    let app: any;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createApp();
        process.env.JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----";
    });

    describe('POST /api/users/me/sync', () => {
        it('should return 401 if unauthorized', async () => {
            const res = await app.request('/api/users/me/sync', { method: 'POST' });
            expect(res.status).toBe(401);
        });

        it('should successfully sync user profile', async () => {
            (jwt.verify as any).mockResolvedValue({ sub: 'user-123', username: 'testuser' });

            const mockGithubUser = {
                id: 12345,
                login: 'testuser',
                email: 'test@example.com',
                avatar_url: 'https://synced.avatar.url',
                public_repos: 42,
            };

            (githubService.getUserProfileByUsername as any).mockResolvedValue(mockGithubUser);

            const req = new Request('http://localhost/api/users/me/sync', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer valid_token',
                },
            });
            const res = await app.fetch(req);

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.publicRepos).toBe(42);
            expect(body.email).toBe('test@example.com');
            expect(body.avatarUrl).toBe('https://synced.avatar.url');

            expect(db.update).toHaveBeenCalled();
        });

        it('should return 500 if github fetch fails', async () => {
            (jwt.verify as any).mockResolvedValue({ sub: 'user-123', username: 'testuser' });
            (githubService.getUserProfileByUsername as any).mockRejectedValue(new Error('API Down'));

            const req = new Request('http://localhost/api/users/me/sync', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer valid_token',
                },
            });
            const res = await app.fetch(req);

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe('Failed to sync user profile');
        });
    });
});
