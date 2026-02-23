import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sign } from 'hono/jwt';

const { findManyMock, findUserMock } = vi.hoisted(() => ({
    findManyMock: vi.fn(),
    findUserMock: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        query: {
            users: {
                findFirst: findUserMock,
            },
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
    repoOwner: 'devasignhq',
    repoName: 'mobile-app',
    title: 'Build endpoint',
    description: 'Implement endpoint.',
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

async function buildAuthHeader(userId: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET must be set for tests');
    }

    const token = await sign(
        {
            sub: userId,
            exp: Math.floor(Date.now() / 1000) + 3600,
        },
        secret,
        'HS256',
    );

    return { Authorization: `Bearer ${token}` };
}

describe('GET /bounties/recommended', () => {
    const app = createApp();

    beforeEach(() => {
        findManyMock.mockReset();
        findUserMock.mockReset();
    });

    it('returns 401 without bearer token', async () => {
        const res = await app.request('/bounties/recommended');

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Authorization bearer token is required');
        expect(findUserMock).not.toHaveBeenCalled();
        expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns 400 when limit is invalid', async () => {
        const res = await app.request('/bounties/recommended?limit=0', {
            headers: await buildAuthHeader('reco-limit-user'),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('limit must be an integer');
        expect(findUserMock).not.toHaveBeenCalled();
        expect(findManyMock).not.toHaveBeenCalled();
    });

    it('returns ranked recommendations with relevance scores', async () => {
        findUserMock.mockResolvedValue({
            techStack: ['TypeScript', 'Rust'],
        });
        findManyMock.mockResolvedValue([
            {
                ...baseBountyRow,
                id: 'bounty-typescript',
                techTags: ['TypeScript', 'Hono'],
                createdAt: new Date('2026-02-22T00:00:00.000Z'),
            },
            {
                ...baseBountyRow,
                id: 'bounty-rust',
                techTags: ['Rust', 'Wasm'],
                createdAt: new Date('2026-02-23T00:00:00.000Z'),
            },
            {
                ...baseBountyRow,
                id: 'bounty-python',
                techTags: ['Python'],
                createdAt: new Date('2026-02-24T00:00:00.000Z'),
            },
        ]);

        const res = await app.request('/bounties/recommended?limit=2', {
            headers: await buildAuthHeader('reco-ranked-user'),
        });

        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.meta.cached).toBe(false);
        expect(body.data).toHaveLength(2);
        expect(body.data[0].id).toBe('bounty-typescript');
        expect(body.data[1].id).toBe('bounty-rust');
        expect(body.data[0].relevanceScore).toBeGreaterThan(body.data[1].relevanceScore);
        expect(body.data.every((row: { relevanceScore: number }) => row.relevanceScore > 0)).toBe(true);
        expect(findUserMock).toHaveBeenCalledTimes(1);
        expect(findManyMock).toHaveBeenCalledTimes(1);
    });

    it('reuses cached recommendations for repeated requests within ttl', async () => {
        findUserMock.mockResolvedValue({
            techStack: ['Go'],
        });
        findManyMock.mockResolvedValue([
            {
                ...baseBountyRow,
                id: 'bounty-go',
                techTags: ['Go', 'API'],
            },
        ]);

        const headers = await buildAuthHeader('reco-cache-user');

        const first = await app.request('/bounties/recommended?limit=5', { headers });
        expect(first.status).toBe(200);
        const firstBody = await first.json();
        expect(firstBody.meta.cached).toBe(false);

        const second = await app.request('/bounties/recommended?limit=5', { headers });
        expect(second.status).toBe(200);
        const secondBody = await second.json();
        expect(secondBody.meta.cached).toBe(true);

        expect(findUserMock).toHaveBeenCalledTimes(1);
        expect(findManyMock).toHaveBeenCalledTimes(1);
    });
});
