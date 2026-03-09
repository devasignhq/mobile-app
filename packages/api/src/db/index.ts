import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { getDatabaseUrl } from './config';

const databaseUrl = getDatabaseUrl();

const client = postgres(databaseUrl, {
    ssl: 'require',
    connect_timeout: 30, // Increase timeout to 30s to handle Neon Serverless cold starts
    max: 10,             // Number of max connections
});
export const db = drizzle(client, { schema });

