import { describe, it, expect } from 'vitest';
import { extensionRequests } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Extension Requests Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(extensionRequests).name).toBe('extension_requests');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(extensionRequests);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('bounty_id');
        expect(columnNames).toContain('developer_id');
        expect(columnNames).toContain('requested_at');
        expect(columnNames).toContain('new_deadline');
        expect(columnNames).toContain('status');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(extensionRequests).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(extensionRequests).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('bounty_id', { notNull: true, hasDefault: false });
        checkColumn('developer_id', { notNull: true, hasDefault: false });
        checkColumn('requested_at', { notNull: true, hasDefault: true });
        checkColumn('new_deadline', { notNull: true, hasDefault: false });
        checkColumn('status', { notNull: true, hasDefault: true });
    });

    it('should have correct indexes', () => {
        const config = getTableConfig(extensionRequests);
        const indexNames = config.indexes.map(i => i.config.name);
        expect(indexNames).toContain('extension_requests_bounty_id_idx');
        expect(indexNames).toContain('extension_requests_developer_id_idx');
    });

    it('should use the correct enum for status', () => {
        const statusColumn = getTableConfig(extensionRequests).columns.find(c => c.name === 'status');
        expect(statusColumn?.columnType).toBe('PgEnumColumn');
    });
});
