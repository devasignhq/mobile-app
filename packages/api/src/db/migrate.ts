import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getDatabaseUrl } from './config';

async function runMigrate() {
    try {
        const databaseUrl = getDatabaseUrl();
        console.log('⏳ Running migrations...');

        const start = Date.now();
        const client = postgres(databaseUrl, { max: 1 });
        const db = drizzle(client);

        await migrate(db, { migrationsFolder: './drizzle' });
        const end = Date.now();
        console.log(`✅ Migrations completed in ${end - start}ms`);
        await client.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed');
        console.error(error);
        process.exit(1);
    }
}

runMigrate();

