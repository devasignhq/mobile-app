import { describe, it, expect } from 'vitest';
import { transactions } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Transactions Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(transactions).name).toBe('transactions');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(transactions);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('type');
        expect(columnNames).toContain('amount_usdc');
        expect(columnNames).toContain('bounty_id');
        expect(columnNames).toContain('stellar_tx_hash');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(transactions).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(transactions).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('user_id', { notNull: true, hasDefault: false });
        checkColumn('type', { notNull: true, hasDefault: false });
        checkColumn('amount_usdc', { notNull: true, hasDefault: false });
        checkColumn('bounty_id', { notNull: false, hasDefault: false });
        checkColumn('stellar_tx_hash', { notNull: false, hasDefault: false });
        checkColumn('status', { notNull: true, hasDefault: true });
        checkColumn('created_at', { notNull: true, hasDefault: true });
        checkColumn('updated_at', { notNull: true, hasDefault: true });
    });

    it('should have correct indexes', () => {
        const config = getTableConfig(transactions);
        const indexNames = config.indexes.map(i => i.config.name);
        expect(indexNames).toContain('transactions_user_id_idx');
        expect(indexNames).toContain('transactions_bounty_id_idx');
        expect(indexNames).toContain('transactions_status_idx');
    });

    it('should have a unique constraint on stellar_tx_hash', () => {
        const config = getTableConfig(transactions);
        const indexNames = config.indexes.map(i => i.config.name);
        expect(indexNames).toContain('transactions_stellar_tx_hash_idx');

        const txHashIndex = config.indexes.find((i) => i.config.name === 'transactions_stellar_tx_hash_idx');
        expect(txHashIndex?.config.unique).toBe(true);
    });

    it('should use the correct enums', () => {
        const typeColumn = getTableConfig(transactions).columns.find(c => c.name === 'type');
        const statusColumn = getTableConfig(transactions).columns.find(c => c.name === 'status');

        expect(typeColumn?.columnType).toBe('PgEnumColumn');
        expect(statusColumn?.columnType).toBe('PgEnumColumn');
    });
});
