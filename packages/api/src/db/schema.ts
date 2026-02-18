import { pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    fullName: text('full_name'),
    email: varchar('email', { length: 256 }).notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
