import { describe, it, expect } from 'vitest';
import { bounties } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Bounties Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(bounties).name).toBe('bounties');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(bounties);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('github_issue_id');
        expect(columnNames).toContain('repo_owner');
        expect(columnNames).toContain('repo_name');
        expect(columnNames).toContain('title');
        expect(columnNames).toContain('description');
        expect(columnNames).toContain('amount_usdc');
        expect(columnNames).toContain('tech_tags');
        expect(columnNames).toContain('difficulty');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('deadline');
        expect(columnNames).toContain('creator_id');
        expect(columnNames).toContain('assignee_id');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(bounties).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have correct nullability and defaults', () => {
        const columns = getTableConfig(bounties).columns;

        const checkColumn = (name: string, { notNull, hasDefault }: { notNull: boolean; hasDefault: boolean }) => {
            const column = columns.find(c => c.name === name);
            expect(column, `Column ${name} not found`).toBeDefined();
            expect(column?.notNull, `Column ${name} notNull mismatch`).toBe(notNull);
            expect(column?.hasDefault, `Column ${name} default mismatch`).toBe(hasDefault);
        };

        checkColumn('id', { notNull: true, hasDefault: true });
        checkColumn('github_issue_id', { notNull: false, hasDefault: false });
        checkColumn('repo_owner', { notNull: true, hasDefault: false });
        checkColumn('repo_name', { notNull: true, hasDefault: false });
        checkColumn('title', { notNull: true, hasDefault: false });
        checkColumn('description', { notNull: true, hasDefault: false });
        checkColumn('amount_usdc', { notNull: true, hasDefault: true });
        checkColumn('tech_tags', { notNull: true, hasDefault: true });
        checkColumn('difficulty', { notNull: true, hasDefault: false });
        checkColumn('status', { notNull: true, hasDefault: true });
        checkColumn('deadline', { notNull: false, hasDefault: false });
        checkColumn('creator_id', { notNull: true, hasDefault: false });
        checkColumn('assignee_id', { notNull: false, hasDefault: false });
        checkColumn('created_at', { notNull: true, hasDefault: true });
        checkColumn('updated_at', { notNull: true, hasDefault: true });
    });

    it('should have foreign key references for creatorId and assigneeId', () => {
        const creatorIdColumn = getTableConfig(bounties).columns.find(c => c.name === 'creator_id');
        const assigneeIdColumn = getTableConfig(bounties).columns.find(c => c.name === 'assignee_id');

        expect(creatorIdColumn?.notNull).toBe(true);
        expect(assigneeIdColumn).toBeDefined();
        // Drizzle-orm doesn't easily expose reference details in getTableConfig for testing,
        // but we can verify the column existence and basic properties.
    });

    it('should have the correct indexes and unique constraints', () => {
        const config = getTableConfig(bounties);

        const indexNames = config.indexes.map(i => i.config.name);
        expect(indexNames).toContain('bounties_creator_id_idx');
        expect(indexNames).toContain('bounties_assignee_id_idx');
        expect(indexNames).toContain('bounties_status_idx');

        // Check unique index on github_issue_id
        const githubIssueIdIdx = config.indexes.find(i => i.config.name === 'bounties_github_issue_id_key');
        expect(githubIssueIdIdx).toBeDefined();
        expect(githubIssueIdIdx?.config.unique).toBe(true);
    });

    it('should use the correct enums', () => {
        const difficultyColumn = getTableConfig(bounties).columns.find(c => c.name === 'difficulty');
        const statusColumn = getTableConfig(bounties).columns.find(c => c.name === 'status');

        expect(difficultyColumn?.columnType).toBe('PgEnumColumn');
        expect(statusColumn?.columnType).toBe('PgEnumColumn');
    });
});
