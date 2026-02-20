import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';

describe('API App', () => {
    const mockDb = {
        execute: vi.fn(),
    };

    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp({ db: mockDb });
    });

    describe('GET /health', () => {
        it('should return 200 with status ok', async () => {
            const res = await app.request('/health');
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    describe('GET /bounties/:id', () => {
        it('should return 400 for invalid bounty ID format', async () => {
            const res = await app.request('/bounties/not-a-valid-uuid');
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Invalid bounty ID format');
        });

        it('should return 404 when bounty not found', async () => {
            mockDb.execute.mockResolvedValueOnce({ rows: [] });
            const res = await app.request('/bounties/00000000-0000-0000-0000-000000000000');
            expect(res.status).toBe(404);
        });

        it('should return bounty details when found', async () => {
            const mockRow = {
                id: '11111111-1111-1111-1111-111111111111',
                github_issue_id: 123,
                repo_owner: 'acme',
                repo_name: 'repo',
                title: 'Test bounty',
                description: 'Desc',
                amount_usdc: '100',
                tech_tags: ['ts'],
                difficulty: 'beginner',
                status: 'open',
                deadline: null,
                creator_id: '22222222-2222-2222-2222-222222222222',
                assignee_id: '33333333-3333-3333-3333-333333333333',
                created_at: '2026-02-19T00:00:00.000Z',
                updated_at: '2026-02-19T00:00:00.000Z',
                creator_username: 'creator',
                creator_avatar_url: 'https://example.com/c.png',
                assignee_username: 'assignee',
                assignee_avatar_url: 'https://example.com/a.png',
                application_count: 7,
            };

            mockDb.execute.mockResolvedValueOnce({ rows: [mockRow] });

            const res = await app.request('/bounties/11111111-1111-1111-1111-111111111111');
            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body).toMatchObject({
                id: '11111111-1111-1111-1111-111111111111',
                repoOwner: 'acme',
                repoName: 'repo',
                title: 'Test bounty',
                amountUsdc: '100',
                applicationCount: 7,
                creator: {
                    username: 'creator',
                },
                assignee: {
                    username: 'assignee',
                },
            });

            // ensure internal IDs are not exposed
            expect(body.creator.id).toBeUndefined();
            expect(body.assignee.id).toBeUndefined();
        });

        it('should return bounty details with null assignee if unassigned', async () => {
            const mockRow = {
                id: '11111111-1111-1111-1111-111111111111',
                github_issue_id: 123,
                repo_owner: 'acme',
                repo_name: 'repo',
                title: 'Unassigned Bounty',
                description: 'Desc',
                amount_usdc: '100',
                tech_tags: ['ts'],
                difficulty: 'beginner',
                status: 'open',
                deadline: null,
                creator_id: '22222222-2222-2222-2222-222222222222',
                assignee_id: null,
                created_at: '2026-02-19T00:00:00.000Z',
                updated_at: '2026-02-19T00:00:00.000Z',
                creator_username: 'creator',
                creator_avatar_url: 'https://example.com/c.png',
                assignee_username: null,
                assignee_avatar_url: null,
                application_count: 3,
            };

            mockDb.execute.mockResolvedValueOnce({ rows: [mockRow] });

            const res = await app.request('/bounties/11111111-1111-1111-1111-111111111111');
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.assignee).toBeNull();
        });
    });
});
