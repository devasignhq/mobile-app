import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL ERROR: GEMINI_API_KEY is not defined in the environment.');
    process.exit(1);
}

const app = new Hono();
const port = Number(process.env.PORT) || 3001;

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
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return c.json({ error: 'Gemini API key not configured on server' }, 500);
        }

        // This is where the actual Gemini API call would go.
        // For now, we'll just return a success message indicating the secure setup works.
        // In a real implementation, you would use the Google Generative AI SDK here.

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

    } catch (error: any) {
        console.error('Error processing Gemini request:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

console.log(`Server is running on http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port
});
