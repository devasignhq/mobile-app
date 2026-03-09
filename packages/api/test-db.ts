import { db } from './src/db';
import { users } from './src/db/schema';

async function main() {
    try {
        console.log('Connecting to database...');
        const result = await db.select().from(users).limit(1);
        console.log('Successfully connected and queried users:', result);
        process.exit(0);
    } catch (e) {
        console.error('Failed to query database:', e);
        process.exit(1);
    }
}

main();
