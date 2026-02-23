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

    describe('POST /bounties/:id/apply', () => {
        const bountyId = '11111111-1111-1111-1111-111111111111';
        const applicantId = '22222222-2222-2222-2222-222222222222';
        const payload = { 
            coverLetter: 'I want this',
            applicantId,
            estimatedTime: 5,
            experienceLinks: ['https://github.com/test']
        };

        it('should return 400 for invalid bounty ID format', async () => {
            const res = await app.request('/bounties/invalid/apply', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 if coverLetter is missing', async () => {
            const res = await app.request(`/bounties/${bountyId}/apply`, {
                method: 'POST',
                body: JSON.stringify({ applicantId })
            });
            expect(res.status).toBe(400);
        });

        it('should return 404 if bounty not found', async () => {
            mockDb.execute.mockResolvedValueOnce({ rows: [] });
            const res = await app.request(`/bounties/${bountyId}/apply`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(404);
        });

        it('should return 400 if bounty is not open', async () => {
            mockDb.execute.mockResolvedValueOnce({ rows: [{ status: 'assigned' }] });
            const res = await app.request(`/bounties/${bountyId}/apply`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('no longer open');
        });

        it('should return 201 and application data on success', async () => {
            mockDb.execute.mockResolvedValueOnce({ rows: [{ status: 'open' }] }); // check
            mockDb.execute.mockResolvedValueOnce({ rows: [{ id: 'app-123', ...payload }] }); // insert
            
            const res = await app.request(`/bounties/${bountyId}/apply`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.id).toBe('app-123');
        });

        it('should return 400 on duplicate application', async () => {
            mockDb.execute.mockResolvedValueOnce({ rows: [{ status: 'open' }] }); // check
            const err = new Error('unique constraint');
            (err as any).code = '23505';
            mockDb.execute.mockRejectedValueOnce(err); // insert fail
            
            const res = await app.request(`/bounties/${bountyId}/apply`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('already applied');
        });
    });
});
