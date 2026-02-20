import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { getDatabaseUrl } from './config';
import * as schema from './schema';

async function seed() {
    console.log('⏳ Seeding database...');

    try {
        const db = drizzle(neon(getDatabaseUrl()), { schema });

        // Add your seeding logic here

        console.log('✅ Seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed');
        console.error(error);
        process.exit(1);
    }
}

seed();
