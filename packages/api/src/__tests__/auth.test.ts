/* eslint-disable @typescript-eslint/no-explicit-any */
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

vi.mock('hono/jwt', async (importOriginal) => {
    const original = await importOriginal<typeof import('hono/jwt')>();
    return {
        ...original,
        sign: vi.fn(async () => 'mocked-jwt-token'),
    };
});

vi.mock('../db', () => ({
    db: {
        query: {
            users: {
                findFirst: vi.fn(),
            },
            refreshTokens: {
                findFirst: vi.fn(),
            }
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(),
            })),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(),
        })),
        delete: vi.fn(() => ({
            where: vi.fn(),
        })),
        transaction: vi.fn(async (cb) => {
            await cb({
                delete: vi.fn(() => ({ where: vi.fn() })),
                insert: vi.fn(() => ({ values: vi.fn() })),
            });
        }),
    },
}));

describe('Authentication Flow', () => {
    let app: any;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createApp();
        process.env.JWT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nfake-key\n-----END PRIVATE KEY-----";
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

        it('should successfully authenticate and return user + token + refreshToken', async () => {
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
            expect(body.refreshToken).toBeDefined();

            // Verify db calls
            expect(db.query.users.findFirst).toHaveBeenCalledTimes(2);
            expect(db.insert).toHaveBeenCalledTimes(2); // Once for user, once for refresh token
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
            expect(body.refreshToken).toBeDefined();

            // Verify db calls
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

        it('should return 500 if JWT_PRIVATE_KEY is missing', async () => {
            delete process.env.JWT_PRIVATE_KEY;

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
        });
    });

    describe('POST /auth/refresh', () => {
        it('should return 400 if refresh token is missing', async () => {
            const res = await app.request('/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Refresh token is required');
        });

        it('should return 401 if refresh token is invalid', async () => {
            (db.query.refreshTokens.findFirst as any).mockResolvedValue(null);

            const res = await app.request('/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: 'invalid_token' }),
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe('Invalid refresh token');
        });

        it('should return 401 if refresh token has expired', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            (db.query.refreshTokens.findFirst as any).mockResolvedValue({
                id: 'token-123',
                userId: 'user-123',
                token: 'expired_token',
                expiresAt: pastDate
            });

            const res = await app.request('/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: 'expired_token' }),
            });

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe('Refresh token has expired');
            expect(db.delete).toHaveBeenCalled();
        });

        it('should successfully rotate refresh token and issue new access token', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            (db.query.refreshTokens.findFirst as any).mockResolvedValue({
                id: 'token-123',
                userId: 'user-123',
                token: 'valid_token',
                expiresAt: futureDate
            });

            (db.query.users.findFirst as any).mockResolvedValue({
                id: 'user-123',
                username: 'testuser',
                email: 'test@example.com'
            });

            const res = await app.request('/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: 'valid_token' }),
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.token).toBeDefined();
            expect(body.refreshToken).toBeDefined();
            expect(db.transaction).toHaveBeenCalled();
        });
    });

    describe('POST /auth/logout', () => {
        it('should return 400 if refresh token is missing', async () => {
            const res = await app.request('/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Refresh token is required');
        });

        it('should successfully revoke refresh token', async () => {
            const res = await app.request('/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: 'some_token' }),
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(db.delete).toHaveBeenCalled();
        });
    });
});
