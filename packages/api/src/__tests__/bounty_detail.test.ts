import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({ verify: vi.fn() }));

vi.mock('../db', () => ({
    db: {
        query: {
            bounties: { findFirst: vi.fn() },
            users: { findFirst: vi.fn() },
        },
        select: vi.fn(),
    },
}));

const DEVELOPER_ID = 'user-uuid-dev';
const CREATOR_ID = 'user-uuid-creator';
const ASSIGNEE_ID = 'user-uuid-assignee';
const BOUNTY_ID = 'bounty-uuid-001';

const mockCreator = { id: CREATOR_ID, username: 'alice', avatarUrl: 'https://example.com/alice.png' };
const mockAssignee = { id: ASSIGNEE_ID, username: 'bob', avatarUrl: 'https://example.com/bob.png' };

const mockBountyBase = {
    id: BOUNTY_ID,
    title: 'Fix authentication bug',
    description: 'Detailed description',
    amountUsdc: '500.0000000',
    techTags: ['typescript', 'hono'],
    difficulty: 'intermediate',
    status: 'assigned',
    deadline: new Date('2026-06-01T00:00:00Z'),
    creatorId: CREATOR_ID,
    assigneeId: ASSIGNEE_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    repoOwner: 'org',
    repoName: 'repo',
    githubIssueId: 42,
};

function mockSelectCountChain(countValue: number) {
    vi.mocked(db.select).mockReturnValue({
        from: () => ({
            where: vi.fn().mockResolvedValue([{ count: BigInt(countValue) }]),
        }),
    } as any);
}

describe('GET /api/bounties/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    it('should return bounty with creator, assignee, and application_count', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBountyBase as any);
        vi.mocked(db.query.users.findFirst)
            .mockResolvedValueOnce(mockCreator as any)   // creator query
            .mockResolvedValueOnce(mockAssignee as any); // assignee query
        mockSelectCountChain(3);

        const res = await app.request(`/api/bounties/${BOUNTY_ID}`, {
            method: 'GET',
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(BOUNTY_ID);
        expect(body.creator).toEqual(mockCreator);
        expect(body.assignee).toEqual(mockAssignee);
        expect(body.application_count).toBe(3);
        expect(body.status).toBe('assigned');
    });

    it('should return null assignee when bounty is unassigned', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        const unassignedBounty = { ...mockBountyBase, assigneeId: null, status: 'open' };
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(unassignedBounty as any);
        vi.mocked(db.query.users.findFirst).mockResolvedValue(mockCreator as any); // only creator
        mockSelectCountChain(0);

        const res = await app.request(`/api/bounties/${BOUNTY_ID}`, {
            method: 'GET',
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.assignee).toBeNull();
        expect(body.application_count).toBe(0);
    });

    it('should return 404 when bounty does not exist', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(undefined as any);

        const res = await app.request('/api/bounties/nonexistent-id', {
            method: 'GET',
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });

    it('should include creator with null fields when user record is missing', async () => {
        vi.mocked(verify).mockResolvedValue({ sub: DEVELOPER_ID, username: 'dev', exp: 9999999999 });
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(mockBountyBase as any);
        vi.mocked(db.query.users.findFirst)
            .mockResolvedValueOnce(undefined as any) // creator not found
            .mockResolvedValueOnce(mockAssignee as any);
        mockSelectCountChain(1);

        const res = await app.request(`/api/bounties/${BOUNTY_ID}`, {
            method: 'GET',
            headers: { Authorization: 'Bearer valid.token' },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.creator).toBeNull();
        expect(body.application_count).toBe(1);
    });

    it('should return 401 without auth token', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Unauthorized'));

        const res = await app.request(`/api/bounties/${BOUNTY_ID}`, {
            method: 'GET',
        });

        expect(res.status).toBe(401);
    });
});
