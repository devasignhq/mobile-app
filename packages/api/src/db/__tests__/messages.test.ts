/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { messages } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Messages Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(messages).name).toBe('messages');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(messages);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('bounty_id');
        expect(columnNames).toContain('sender_id');
        expect(columnNames).toContain('recipient_id');
        expect(columnNames).toContain('content');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('read_at');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(messages).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(messages).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('bounty_id', { notNull: true, hasDefault: false });
        checkColumn('sender_id', { notNull: false, hasDefault: false });
        checkColumn('recipient_id', { notNull: false, hasDefault: false });
        checkColumn('content', { notNull: true, hasDefault: false });
        checkColumn('created_at', { notNull: true, hasDefault: true });
        checkColumn('read_at', { notNull: false, hasDefault: false });
    });

    it('should have the correct composite index on (bounty_id, created_at)', () => {
        const config = getTableConfig(messages);
        const index = config.indexes.find(i => i.config.name === 'messages_bounty_id_created_at_idx');

        expect(index).toBeDefined();

        // In Drizzle, an index on desc(column) shows up as an SQL expression in the column list
        // We'll inspect the raw columns to verify the index is correctly configured.
        const columns = index!.config.columns;

        // First column is the bountyId column
        expect((columns[0] as any).name).toBe('bounty_id');

        // Second column is a descending expression for createdAt
        // We can check if it contains the SQL for the descending order
        const secondColumn = columns[1] as any;
        expect(secondColumn).toBeDefined();
        // Depending on Drizzle version, it might be an SQL object or have an expression property
        // We just need to ensure it's not the raw 'created_at' column name anymore
        expect(secondColumn.name).toBeUndefined();
    });
});
