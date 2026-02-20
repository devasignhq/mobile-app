import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';
import { getDatabaseUrl } from './config';

async function runMigrate() {
    try {
        const databaseUrl = getDatabaseUrl();
        console.log('⏳ Running migrations...');

        const start = Date.now();
        const sql = neon(databaseUrl);
        const db = drizzle(sql);

        await migrate(db, { migrationsFolder: './drizzle' });
        const end = Date.now();
        console.log(`✅ Migrations completed in ${end - start}ms`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed');
        console.error(error);
        process.exit(1);
    }
}

runMigrate();
