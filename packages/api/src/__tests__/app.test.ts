import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app';

describe('API App', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
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
        it('should return 200 with valid prompt', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'Hello, AI!' }),
            });

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({
                message: 'Request received securely on backend',
                status: 'success',
            });
        });

        it('should return 400 when prompt is missing', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            expect(res.status).toBe(400);

            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is empty string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '   ' }),
            });

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is not a string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 123 }),
            });

            expect(res.status).toBe(400);
        });
    });
});
