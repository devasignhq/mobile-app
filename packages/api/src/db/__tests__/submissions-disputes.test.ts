import { describe, it, expect } from 'vitest';
import { submissions, disputes } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Submissions Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(submissions).name).toBe('submissions');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(submissions);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('bounty_id');
        expect(columnNames).toContain('developer_id');
        expect(columnNames).toContain('pr_url');
        expect(columnNames).toContain('supporting_links');
        expect(columnNames).toContain('notes');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('rejection_reason');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
        expect(config.columns).toHaveLength(10);
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(submissions).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(submissions).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('bounty_id', { notNull: true, hasDefault: false });
        checkColumn('developer_id', { notNull: true, hasDefault: false });
        checkColumn('pr_url', { notNull: true, hasDefault: false });
        checkColumn('supporting_links', { notNull: false, hasDefault: false });
        checkColumn('notes', { notNull: false, hasDefault: false });
        checkColumn('status', { notNull: true, hasDefault: true });
        checkColumn('rejection_reason', { notNull: false, hasDefault: false });
        checkColumn('created_at', { notNull: true, hasDefault: true });
        checkColumn('updated_at', { notNull: true, hasDefault: true });
    });

    it('should have foreign key constraints', () => {
        const config = getTableConfig(submissions);
        expect(config.foreignKeys).toHaveLength(2);
    });

    it('should have the correct indexes', () => {
        const config = getTableConfig(submissions);
        const indexNames = config.indexes.map(i => i.config.name);

        expect(indexNames).toContain('submissions_bounty_id_idx');
        expect(indexNames).toContain('submissions_developer_id_idx');
        expect(indexNames).toContain('submissions_status_idx');
        expect(config.indexes).toHaveLength(3);
    });

    it('should use the submission_status enum for the status column', () => {
        const statusColumn = getTableConfig(submissions).columns.find(c => c.name === 'status');
        expect(statusColumn?.columnType).toBe('PgEnumColumn');
    });
});

describe('Disputes Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(disputes).name).toBe('disputes');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(disputes);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('submission_id');
        expect(columnNames).toContain('reason');
        expect(columnNames).toContain('evidence_links');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
        expect(config.columns).toHaveLength(7);
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(disputes).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(disputes).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('submission_id', { notNull: true, hasDefault: false });
        checkColumn('reason', { notNull: true, hasDefault: false });
        checkColumn('evidence_links', { notNull: false, hasDefault: false });
        checkColumn('status', { notNull: true, hasDefault: true });
        checkColumn('created_at', { notNull: true, hasDefault: true });
        checkColumn('updated_at', { notNull: true, hasDefault: true });
    });

    it('should have foreign key constraints', () => {
        const config = getTableConfig(disputes);
        expect(config.foreignKeys).toHaveLength(1);
    });

    it('should have the correct indexes', () => {
        const config = getTableConfig(disputes);
        const indexNames = config.indexes.map(i => i.config.name);

        expect(indexNames).toContain('disputes_submission_id_idx');
        expect(indexNames).toContain('disputes_status_idx');
        expect(config.indexes).toHaveLength(2);
    });

    it('should use the dispute_status enum for the status column', () => {
        const statusColumn = getTableConfig(disputes).columns.find(c => c.name === 'status');
        expect(statusColumn?.columnType).toBe('PgEnumColumn');
    });
});
