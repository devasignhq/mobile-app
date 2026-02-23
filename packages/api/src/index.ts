import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import { createApp } from './app';

// Load environment variables
dotenv.config();

// Default NODE_ENV to 'development' if not set
process.env.NODE_ENV ??= 'development';

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
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('FATAL ERROR: GEMINI_API_KEY is not defined or is set to the default placeholder.');
    process.exit(1);
}

if (!process.env.JWT_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY.includes('CHANGE_ME')) {
    console.error('FATAL ERROR: JWT_PRIVATE_KEY is not defined or is set to the default placeholder.');
    process.exit(1);
}

if (!process.env.JWT_PUBLIC_KEY || process.env.JWT_PUBLIC_KEY.includes('CHANGE_ME')) {
    console.error('FATAL ERROR: JWT_PUBLIC_KEY is not defined or is set to the default placeholder.');
    process.exit(1);
}

// Warn about optional but recommended environment variables
const optionalVars = [
    { name: 'REDIS_URL', group: 'Redis' },
    { name: 'GITHUB_CLIENT_ID', group: 'GitHub OAuth' },
    { name: 'GITHUB_CLIENT_SECRET', group: 'GitHub OAuth' },
    { name: 'GITHUB_CALLBACK_URL', group: 'GitHub OAuth' },
    { name: 'STELLAR_NETWORK', group: 'Stellar' },
    { name: 'STELLAR_HORIZON_URL', group: 'Stellar' },
    { name: 'STELLAR_ISSUER_SECRET', group: 'Stellar' },
];

const missingOptional = optionalVars.filter(v => !process.env[v.name]);
if (missingOptional.length > 0) {
    const groups = [...new Set(missingOptional.map(v => v.group))];
    console.warn(
        `⚠ Missing optional env vars (${groups.join(', ')} integrations may be disabled): ${missingOptional.map(v => v.name).join(', ')}`
    );
}

const app = createApp();
const port = Number(process.env.PORT) || 3001;

console.log(`Server is running on http://localhost:${port}`);

serve({
    fetch: app.fetch,
    port
});
