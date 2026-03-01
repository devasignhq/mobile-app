import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

vi.mock('../db', () => ({
    db: {
        query: {
            bounties: {
                findFirst: vi.fn(),
            },
            applications: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(),
    },
}));

const TEST_USER_ID = 'test-developer-id';
const TEST_BOUNTY_ID = 'bounty-uuid-001';
const TEST_CREATOR_ID = 'creator-uuid-001';

describe('POST /api/bounties/:id/apply', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();

        vi.mocked(verify).mockResolvedValue({
            sub: TEST_USER_ID,
            username: 'testdev',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        process.env.JWT_PUBLIC_KEY =
            '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    const validBody = {
        cover_letter: 'I have experience with this stack.',
        estimated_time: 10,
        experience_links: ['https://github.com/example/repo'],
    };

    const openBounty = {
        id: TEST_BOUNTY_ID,
        status: 'open',
        creatorId: TEST_CREATOR_ID,
    };

    it('should create an application and return 201', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(openBounty as any);
        vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

        const insertReturning = vi.fn().mockResolvedValue([{
            id: 'app-uuid-001',
            bountyId: TEST_BOUNTY_ID,
            applicantId: TEST_USER_ID,
            coverLetter: validBody.cover_letter,
            estimatedTime: validBody.estimated_time,
            experienceLinks: validBody.experience_links,
            status: 'pending',
            createdAt: new Date('2026-03-01T00:00:00Z'),
        }]);
        vi.mocked(db.insert).mockReturnValue({ values: () => ({ returning: insertReturning }) } as any);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe('app-uuid-001');
        expect(body.status).toBe('pending');
        expect(body.bounty_id).toBe(TEST_BOUNTY_ID);
    });

    it('should return 404 if bounty does not exist', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/bounties/nonexistent/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(404);
    });

    it('should return 409 if bounty is not open', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue({
            ...openBounty, status: 'assigned',
        } as any);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toMatch(/not open/i);
    });

    it('should return 403 if creator tries to apply to own bounty', async () => {
        vi.mocked(verify).mockResolvedValueOnce({
            sub: TEST_CREATOR_ID,
            username: 'creator',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(openBounty as any);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toMatch(/own bounty/i);
    });

    it('should return 409 if already applied', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(openBounty as any);
        vi.mocked(db.query.applications.findFirst).mockResolvedValue({ id: 'existing' } as any);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toMatch(/already applied/i);
    });

    it('should return 400 if cover_letter is missing', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(openBounty as any);
        vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ estimated_time: 5 }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/cover_letter/i);
    });

    it('should return 400 if estimated_time is not a positive integer', async () => {
        vi.mocked(db.query.bounties.findFirst).mockResolvedValue(openBounty as any);
        vi.mocked(db.query.applications.findFirst).mockResolvedValue(undefined);

        const res = await app.request(`/api/bounties/${TEST_BOUNTY_ID}/apply`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cover_letter: 'Good letter', estimated_time: -5 }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/estimated_time/i);
    });
});
