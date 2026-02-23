import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, Variables } from '../../middleware/auth';
import { verify } from 'hono/jwt';

// Mock getFormattedPublicKey via process.env for simplicity
const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nfake-public-key\n-----END PUBLIC KEY-----';

vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

describe('Auth Middleware', () => {
    let app: Hono<{ Variables: Variables }>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = new Hono<{ Variables: Variables }>();
        process.env.JWT_PUBLIC_KEY = mockPublicKey;
        // The middleware will be tested using hono/jwt's sign/verify against these keys
        app.use('/protected/*', authMiddleware);
        app.get('/protected/data', (c) => {
            const user = c.get('user');
            return c.json({ data: 'secret', user });
        });
    });

    it('should return 401 if Authorization header is missing', async () => {
        const res = await app.request('/protected/data');
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Missing or invalid Authorization header');
    });

    it('should return 401 if Authorization header does not start with Bearer', async () => {
        const res = await app.request('/protected/data', {
            headers: {
                Authorization: 'Basic some-token'
            }
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Missing or invalid Authorization header');
    });

    it('should return 401 if token is missing from Bearer header', async () => {
        const res = await app.request('/protected/data', {
            headers: {
                Authorization: 'Bearer '
            }
        });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Token missing from Authorization header');
    });

    it('should return 500 if JWT_PUBLIC_KEY is not configured', async () => {
        delete process.env.JWT_PUBLIC_KEY;
        const res = await app.request('/protected/data', {
            headers: {
                Authorization: 'Bearer any-token'
            }
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Internal server configuration error');
    });

    describe('Valid Token Handling', () => {
        it('should inject user context and call next for a valid token', async () => {
            // Mock verify to return a valid payload
            vi.mocked(verify).mockResolvedValueOnce({ sub: 'user-123', username: 'testuser', exp: Math.floor(Date.now() / 1000) + 3600 });

            const res = await app.request('/protected/data', {
                headers: {
                    Authorization: 'Bearer valid.mocked.token'
                }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBe('secret');
            expect(body.user).toEqual({ id: 'user-123', username: 'testuser' });
        });

        it('should return 401 if token is invalid or expired', async () => {
            // Mock verify to throw an error (e.g., signature invalid, or token expired)
            vi.mocked(verify).mockRejectedValueOnce(new Error('Token expired'));

            const res = await app.request('/protected/data', {
                headers: {
                    Authorization: 'Bearer expired.or.invalid.token'
                }
            });

            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.error).toBe('Invalid or expired token');
        });
    });
});
