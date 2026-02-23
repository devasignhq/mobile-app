import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        query: {
            bounties: {
                findMany: findManyMock,
            },
        },
    },
}));

import { createApp } from '../app';

const baseBountyRow = {
    id: 'bounty-1',
    githubIssueId: 13,
    repoOwner: 'ubounty-app',
    repoName: 'ubounty-demo',
    title: 'Video e2e demo',
    description: 'Create a 20s demo.',
    amountUsdc: '10.0',
    techTags: ['typescript'],
    difficulty: 'beginner',
    status: 'open',
    deadline: null,
    creatorId: 'creator-1',
    assigneeId: null,
    createdAt: new Date('2026-02-23T00:00:00.000Z'),
    updatedAt: new Date('2026-02-23T00:00:00.000Z'),
};

describe('GET /bounties', () => {
    const app = createApp();

    beforeEach(() => {
        findManyMock.mockReset();
    });

    it('returns paginated bounties with meta envelope', async () => {
        findManyMock.mockResolvedValue([
            baseBountyRow,
            {
                ...baseBountyRow,
                id: 'bounty-2',
                title: 'Second bounty',
                createdAt: new Date('2026-02-22T00:00:00.000Z'),
            },
        ]);

        const res = await app.request(
            '/bounties?limit=1&tech_stack=typescript,node&amount_min=5&amount_max=20&difficulty=beginner&status=open',
        );

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.data).toHaveLength(1);
        expect(body.meta.has_more).toBe(true);
        expect(typeof body.meta.next_cursor).toBe('string');
        expect(findManyMock).toHaveBeenCalledTimes(1);
        expect(findManyMock.mock.calls[0][0].limit).toBe(2);
    });

    it('returns 400 for invalid cursor', async () => {
        const res = await app.request('/bounties?cursor=not-a-valid-cursor');

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('cursor is invalid');
        expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns 400 when amount range is invalid', async () => {
        const res = await app.request('/bounties?amount_min=30&amount_max=10');

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('amount_min cannot be greater than amount_max');
        expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns has_more=false and next_cursor=null when page is complete', async () => {
        findManyMock.mockResolvedValue([baseBountyRow]);

        const res = await app.request('/bounties?limit=10');

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(1);
        expect(body.meta.has_more).toBe(false);
        expect(body.meta.next_cursor).toBeNull();
    });
});
