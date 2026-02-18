import { describe, it, expect } from 'vitest';
import { users, applications } from '../schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('Users Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(users).name).toBe('users');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(users);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('github_id');
        expect(columnNames).toContain('username');
        expect(columnNames).toContain('avatar_url');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('tech_stack');
        expect(columnNames).toContain('wallet_address');
        expect(columnNames).toContain('wallet_secret_enc');
        expect(columnNames).toContain('total_earned');
        expect(columnNames).toContain('bounties_completed');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(users).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have a unique constraint on email', () => {
        const emailColumn = getTableConfig(users).columns.find(c => c.name === 'email');
        expect(emailColumn?.isUnique).toBe(true);
        expect(emailColumn?.notNull).toBe(true);
    });

    it('should have a unique constraint on github_id', () => {
        const githubIdColumn = getTableConfig(users).columns.find(c => c.name === 'github_id');
        expect(githubIdColumn?.isUnique).toBe(true);
    });
});

describe('Applications Table Schema', () => {
    it('should have the correct table name', () => {
        expect(getTableConfig(applications).name).toBe('applications');
    });

    it('should have all required columns with correct types', () => {
        const config = getTableConfig(applications);
        const columnNames = config.columns.map(c => c.name);

        expect(columnNames).toContain('id');
        expect(columnNames).toContain('bounty_id');
        expect(columnNames).toContain('applicant_id');
        expect(columnNames).toContain('cover_letter');
        expect(columnNames).toContain('estimated_time');
        expect(columnNames).toContain('experience_links');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('created_at');
    });

    it('should have a uuid primary key for the id column', () => {
        const idColumn = getTableConfig(applications).columns.find(c => c.name === 'id');
        expect(idColumn?.columnType).toBe('PgUUID');
        expect(idColumn?.primary).toBe(true);
    });

    it('should have foreign key constraints and unique index', () => {
        const config = getTableConfig(applications);
        expect(config.foreignKeys).toHaveLength(2);
        expect(config.indexes).toHaveLength(1);
    });
});
