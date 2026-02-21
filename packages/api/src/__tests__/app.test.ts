import { describe, it, expect, beforeAll } from 'vitest';
import { createApp, type DbLike } from '../app';

describe('API App', () => {
    let app: ReturnType<typeof createApp>;

    const mockDb: DbLike = {
        execute: async () => ({ rows: [] }),
    };

    beforeAll(() => {
        app = createApp({ db: mockDb });
    });

    // ── Health Endpoint ──────────────────────────────────────────────

    describe('GET /health', () => {
        it('should return 200 with status ok', async () => {
            const res = await app.request('/health');

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    // ── Gemini Endpoint ──────────────────────────────────────────────

    describe('POST /api/gemini', () => {
        it('should return 200 with valid prompt', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'Hello, AI!' }),
            });

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({
                message: 'Request received securely on backend',
                status: 'success',
            });
        });

        it('should return 400 when prompt is missing', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            expect(res.status).toBe(400);

            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is empty string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '   ' }),
            });

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is not a string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 123 }),
            });

            expect(res.status).toBe(400);
        });
    });

    // ── Bounties Endpoint ───────────────────────────────────────────

    describe('GET /bounties/:id', () => {
        it('should return 404 when bounty not found', async () => {
            const res = await app.request('/bounties/00000000-0000-0000-0000-000000000000');
            expect(res.status).toBe(404);
        });

        it('should return bounty details when found', async () => {
            const foundDb: DbLike = {
                execute: async () => ({
                    rows: [
                        {
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
                        },
                    ],
                }),
            };

            const app2 = createApp({ db: foundDb });
            const res = await app2.request('/bounties/11111111-1111-1111-1111-111111111111');
            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.id).toBe('11111111-1111-1111-1111-111111111111');
            expect(body.creator.username).toBe('creator');
            expect(body.applicationCount).toBe(7);
            expect(body.assignee.username).toBe('assignee');
        });
    });
});
