import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';

// Mock hono/jwt verify for all tests in this file
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

describe('API App', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        // Since we test auth behavior in auth.test.ts and middleware/auth.test.ts,
        // we just want to bypass the auth middleware here by successful verification
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600
        });

        // Ensure the public key is set so the middleware doesn't fail on missing config
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    // ── Health Endpoint ──────────────────────────────────────────────

    describe('GET /health', () => {
        it('should return 200 with status ok', async () => {
            const res = await app.request('/health');

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    // ── Gemini Endpoint ──────────────────────────────────────────────

    describe('POST /api/gemini', () => {
        it('should return 200 with valid prompt and valid token', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid.mocked.token'
                },
                body: JSON.stringify({ prompt: 'Hello, AI!' }),
            });

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({
                message: 'Request received securely on backend',
                status: 'success',
            });
        });

        it('should return 401 when no token is provided', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'Hello, AI!' }),
            });

            expect(res.status).toBe(401);
        });

        it('should return 400 when prompt is missing (with valid token)', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid.mocked.token'
                },
                body: JSON.stringify({}),
            });

            expect(res.status).toBe(400);

            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is empty string (with valid token)', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid.mocked.token'
                },
                body: JSON.stringify({ prompt: '   ' }),
            });

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is not a string (with valid token)', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer valid.mocked.token'
                },
                body: JSON.stringify({ prompt: 123 }),
            });

            expect(res.status).toBe(400);
        });
    });
});
