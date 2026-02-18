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

// The base URL of the main DevAsign API. Configurable via environment variable.
const DEVASIGN_API_URL = process.env.DEVASIGN_API_URL || 'https://api.devasign.com';

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

/**
 * GET /api/bounties/:id
 *
 * Fetches full details for a single bounty, including:
 *   - Creator info (username, avatarUrl)
 *   - Application count
 *   - Assignee info (if the bounty has been assigned to a developer)
 *   - Current status
 *
 * Proxies to the main DevAsign API at DEVASIGN_API_URL.
 * Returns 404 if the bounty is not found, 502 if the upstream API is unreachable.
 */
app.get('/api/bounties/:id', async (c) => {
    const { id } = c.req.param();

    if (!id || id.trim() === '') {
        return c.json({ error: 'Bounty ID is required' }, 400);
    }

    try {
        const upstreamUrl = `${DEVASIGN_API_URL}/bounties/${encodeURIComponent(id)}`;

        const response = await fetch(upstreamUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Forward the Authorization header if present (authenticated requests)
                ...(c.req.header('Authorization')
                    ? { Authorization: c.req.header('Authorization')! }
                    : {}),
            },
        });

        if (response.status === 404) {
            return c.json({ error: 'Bounty not found' }, 404);
        }

        if (!response.ok) {
            console.error(`Upstream API error: ${response.status} ${response.statusText}`);
            return c.json(
                { error: 'Failed to fetch bounty details from upstream API' },
                502
            );
        }

        const data = await response.json() as {
            id: string;
            repoOwner: string;
            repoName: string;
            title: string;
            description: string;
            amount: number;
            tags: string[];
            difficulty: string;
            deadline: string;
            status: string;
            creator: {
                username: string;
                avatarUrl: string;
                rating: number;
            };
            requirements: string[];
            applicationCount: number;
            assignee: { username: string; avatarUrl: string } | null;
        };

        return c.json(data);
    } catch (error: any) {
        console.error(`Error fetching bounty ${id}:`, error);
        return c.json({ error: 'Unable to reach upstream API' }, 502);
    }
});

console.log(`Server is running on http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port
});
