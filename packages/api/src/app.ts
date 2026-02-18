import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

/**
 * Creates and configures the Hono application with all routes and middleware.
 * Extracted from index.ts to enable testing without triggering server startup
 * or environment variable validation side effects.
 */
export function createApp() {
    const app = new Hono();

    // Global middleware
    app.use('*', logger());
    app.use('*', cors());

    // Rate limiter stub middleware
    app.use('*', async (_c, next) => {
        // TODO(#1): Implement a robust rate limiter (e.g., using `@hono/rate-limiter`).
        // For now, checks are skipped
        await next();
    });

    // Error handler
    app.onError((err, c) => {
        console.error('App Error:', err);
        if (process.env.NODE_ENV === 'production') {
            return c.json({ error: 'Internal server error' }, 500);
        }
        return c.json({ error: 'Internal server error', message: err.message }, 500);
    });

    // API Routes
    app.get('/health', (c) => {
        return c.json({ status: 'ok' });
    });

    app.post('/api/gemini', async (c) => {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('Gemini API key not configured on server');
        }

        const body = await c.req.json();
        const { prompt } = body;

        if (typeof prompt !== 'string' || prompt.trim() === '') {
            return c.json({ error: 'Prompt is required and must be a non-empty string' }, 400);
        }

        console.log('Received prompt:', prompt);

        return c.json({
            message: 'Request received securely on backend',
            status: 'success'
        });
    });

    return app;
}
