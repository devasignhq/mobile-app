import { describe, it, expect, vi } from 'vitest';
import { createMockDb, mockQueryResult } from './db';

describe('Database Mock Utility', () => {
    it('should create a functional mock database client', () => {
        const db = createMockDb();

        expect(db.query).toBeDefined();
        expect(db.connect).toBeDefined();
        expect(db.disconnect).toBeDefined();
        expect(db.transaction).toBeDefined();
    });

    it('should allow configuring mock db query results', async () => {
        const db = createMockDb();
        const mockUsers = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
        db.query.mockResolvedValue(mockQueryResult(mockUsers));

        const result = await db.query('SELECT * FROM users');
        expect(result.rows).toEqual(mockUsers);
        expect(result.rowCount).toBe(2);
    });

    it('should mock transactions and provide a mock client to the callback', async () => {
        const db = createMockDb();
        const callback = vi.fn(async (tx) => {
            await tx.query('INSERT INTO audit DEFAULT VALUES');
            return 'tx-result';
        });

        const result = await db.transaction(callback);

        expect(result).toBe('tx-result');
        expect(callback).toHaveBeenCalled();
    });
});
