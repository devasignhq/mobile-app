import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default NODE_ENV to 'development' if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

// Compose DATABASE_URL from individual POSTGRES_* variables if not explicitly set.
// This allows credentials to be defined in a single place (e.g., the root .env file).
if (!process.env.DATABASE_URL) {
    const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
    const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
    const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';

    if (POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
        process.env.DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
    }
}

if (!process.env.DATABASE_URL) {
    console.error('FATAL ERROR: DATABASE_URL is not defined and could not be composed from POSTGRES_* variables.');
    process.exit(1);
}

// Validate required environment variables
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL ERROR: GEMINI_API_KEY is not defined in the environment.');
    process.exit(1);
}

// Warn about optional but recommended environment variables
const optionalVars = [
    { name: 'REDIS_URL', group: 'Redis' },
    { name: 'GITHUB_CLIENT_ID', group: 'GitHub OAuth' },
    { name: 'GITHUB_CLIENT_SECRET', group: 'GitHub OAuth' },
    { name: 'JWT_SECRET', group: 'JWT Authentication' },
    { name: 'STELLAR_NETWORK', group: 'Stellar' },
    { name: 'STELLAR_HORIZON_URL', group: 'Stellar' },
];

const missingOptional = optionalVars.filter(v => !process.env[v.name]);
if (missingOptional.length > 0) {
    const groups = [...new Set(missingOptional.map(v => v.group))];
    console.warn(
        `⚠ Missing optional env vars (${groups.join(', ')} integrations may be disabled): ${missingOptional.map(v => v.name).join(', ')}`
    );
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
