import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { githubService } from '../services/github';
import { db } from '../db';

// Mock dependencies
vi.mock('../services/github', () => ({
    githubService: {
        getAuthorizationUrl: vi.fn(),
        getAccessToken: vi.fn(),
        getUserProfile: vi.fn(),
    },
}));

vi.mock('../db', () => ({
    db: {
        query: {
            users: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(),
            })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(),
        })),
    },
}));

describe('Authentication Flow', () => {
    let app: any;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createApp();
    });

    describe('GET /auth/github', () => {
        it('should redirect to GitHub authorization URL', async () => {
            const mockUrl = 'https://github.com/login/oauth/authorize?client_id=123';
            (githubService.getAuthorizationUrl as any).mockReturnValue(mockUrl);

            const res = await app.request('/auth/github');

            expect(res.status).toBe(302);
            expect(res.headers.get('Location')).toBe(mockUrl);
        });
    });

    describe('GET /auth/github/callback', () => {
        it('should return 400 if code is missing', async () => {
            const res = await app.request('/auth/github/callback?state=random_state', {
                headers: {
                    Cookie: 'oauth_state=random_state',
                },
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Authorization code missing');
        });

        it('should return 400 if state is invalid or missing from cookie', async () => {
            const res = await app.request('/auth/github/callback?code=abc&state=wrong_state', {
                headers: {
                    Cookie: 'oauth_state=correct_state',
                },
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Invalid state');
        });

        it('should successfully authenticate and return user + token', async () => {
            const mockGithubUser = {
                id: 12345,
                login: 'testuser',
                email: 'test@example.com',
                avatar_url: 'https://avatar.url',
            };

            const mockDbUser = {
                id: 'uuid-123',
                githubId: BigInt(12345),
                username: 'testuser',
                email: 'test@example.com',
                avatarUrl: 'https://avatar.url',
            };

            (githubService.getAccessToken as any).mockResolvedValue('fake-access-token');
            (githubService.getUserProfile as any).mockResolvedValue(mockGithubUser);
            (db.query.users.findFirst as any)
                .mockResolvedValueOnce(null) // First call: user not found
                .mockResolvedValueOnce(mockDbUser); // Second call: re-fetch after insert

            const res = await app.request('/auth/github/callback?code=abc&state=random_state', {
                headers: {
                    Cookie: 'oauth_state=random_state',
                },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.user.username).toBe('testuser');
            expect(body.token).toBeDefined();

            // Verify re-fetch was called
            expect(db.query.users.findFirst).toHaveBeenCalledTimes(2);
        });

        it('should successfully authenticate, update existing user, and re-fetch profile', async () => {
            const mockGithubUser = {
                id: 12345,
                login: 'updateduser',
                email: 'updated@example.com',
                avatar_url: 'https://updated.avatar.url',
            };

            const mockDbUserPreUpdate = {
                id: 'uuid-123',
                githubId: BigInt(12345),
                username: 'olduser',
                email: 'old@example.com',
                avatarUrl: 'https://old.avatar.url',
            };

            const mockDbUserPostUpdate = {
                ...mockDbUserPreUpdate,
                username: 'updateduser',
                email: 'updated@example.com',
                avatarUrl: 'https://updated.avatar.url',
            };

            (githubService.getAccessToken as any).mockResolvedValue('fake-access-token');
            (githubService.getUserProfile as any).mockResolvedValue(mockGithubUser);
            (db.query.users.findFirst as any)
                .mockResolvedValueOnce(mockDbUserPreUpdate) // First call: existing user found
                .mockResolvedValueOnce(mockDbUserPostUpdate); // Second call: re-fetch after update

            const res = await app.request('/auth/github/callback?code=abc&state=random_state', {
                headers: {
                    Cookie: 'oauth_state=random_state',
                },
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.user.username).toBe('updateduser');
            expect(body.user.email).toBe('updated@example.com');
            expect(body.token).toBeDefined();

            // Verify re-fetch was called (twice: findFirst initially, then re-fetch)
            expect(db.query.users.findFirst).toHaveBeenCalledTimes(2);
            expect(db.update).toHaveBeenCalled();
        });

        it('should return 500 with generic message on internal error', async () => {
            (githubService.getAccessToken as any).mockRejectedValue(new Error('GitHub API Error'));

            const res = await app.request('/auth/github/callback?code=abc&state=random_state', {
                headers: {
                    Cookie: 'oauth_state=random_state',
                },
            });

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe('Authentication failed');
            expect(body.message).toBeUndefined(); // Should be sanitized
        });

        it('should return 500 if JWT_SECRET is missing', async () => {
            const originalSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;

            const mockGithubUser = {
                id: 12345,
                login: 'testuser',
                email: 'test@example.com',
                avatar_url: 'https://avatar.url',
            };

            (githubService.getAccessToken as any).mockResolvedValue('fake-access-token');
            (githubService.getUserProfile as any).mockResolvedValue(mockGithubUser);
            (db.query.users.findFirst as any).mockResolvedValue({ id: '1' });

            const res = await app.request('/auth/github/callback?code=abc&state=random_state', {
                headers: {
                    Cookie: 'oauth_state=random_state',
                },
            });

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toBe('Internal server configuration error');

            process.env.JWT_SECRET = originalSecret;
        });
    });
});
