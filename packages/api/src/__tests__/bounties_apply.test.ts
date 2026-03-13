import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

const { mockInsertReturning, mockValues, mockFindFirst } = vi.hoisted(() => ({
    mockInsertReturning: vi.fn(),
    mockValues: vi.fn(),
    mockFindFirst: vi.fn(),
}));

// Wire up the chain so we can inspect arguments
mockValues.mockReturnValue({ returning: mockInsertReturning });

// Mock the database
vi.mock('../db', () => ({
    db: {
        query: {
            bounties: {
                findFirst: mockFindFirst,
            },
        },
        insert: vi.fn().mockReturnValue({
            values: mockValues,
        }),
    },
}));

const OPEN_BOUNTY = {
    id: 'bounty-1',
    title: 'Fix the bug',
    status: 'open',
    creatorId: 'creator-1',
};

const ASSIGNED_BOUNTY = {
    id: 'bounty-2',
    title: 'Assigned bounty',
    status: 'assigned',
    creatorId: 'creator-1',
};

const CREATED_APPLICATION = {
    id: 'app-1',
    bountyId: 'bounty-1',
    applicantId: 'test-user-id',
    coverLetter: 'I am very interested in this bounty.',
    estimatedTime: 5,
    experienceLinks: ['https://github.com/user/project'],
    status: 'pending',
    createdAt: new Date().toISOString(),
};

describe('POST /api/bounties/:id/apply', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Re-wire the mock chain after clearAllMocks
        mockValues.mockReturnValue({ returning: mockInsertReturning });
        (db.insert as any).mockReturnValue({ values: mockValues });
        // Default: valid authenticated user
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if not authenticated', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello' }),
        });

        expect(res.status).toBe(401);
    });

    it('should return 404 if bounty does not exist', async () => {
        mockFindFirst.mockResolvedValue(undefined);

        const res = await app.request('/api/bounties/nonexistent/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello' }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });

    it('should return 400 if bounty is not open', async () => {
        mockFindFirst.mockResolvedValue(ASSIGNED_BOUNTY);

        const res = await app.request('/api/bounties/bounty-2/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello' }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Bounty is not open for applications');
    });

    it('should return 400 with specific Zod error if cover_letter is missing', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ estimated_time: 5 }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.cover_letter).toBeDefined();
        expect(body.error.cover_letter[0]).toContain('string');
    });

    it('should return 400 with specific Zod error if cover_letter is an empty string', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: '   ' }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.cover_letter).toBeDefined();
    });

    it('should return 400 with specific Zod error if estimated_time is not a non-negative integer', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello', estimated_time: -3 }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.estimated_time).toBeDefined();
    });

    it('should return 400 with specific Zod error if experience_links contains non-strings', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello', experience_links: [123] }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.experience_links).toBeDefined();
    });

    it('should return 201 with the created application on success', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);
        mockInsertReturning.mockResolvedValue([CREATED_APPLICATION]);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({
                cover_letter: 'I am very interested in this bounty.',
                estimated_time: 5,
                experience_links: ['https://github.com/user/project'],
            }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe('app-1');
        expect(body.bountyId).toBe('bounty-1');
        expect(body.applicantId).toBe('test-user-id');
        expect(body.coverLetter).toBe('I am very interested in this bounty.');
        expect(body.status).toBe('pending');

        // Verify the correct arguments were passed to the insert
        // applicantId should be 'test-user-id' (mapped from sub)
        expect(mockValues).toHaveBeenCalledWith({
            bountyId: 'bounty-1',
            applicantId: 'test-user-id',
            coverLetter: 'I am very interested in this bounty.',
            estimatedTime: 5,
            experienceLinks: ['https://github.com/user/project'],
        });
    });

    it('should return 201 with defaults when optional fields are omitted', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);
        const minimalApp = { ...CREATED_APPLICATION, estimatedTime: 0, experienceLinks: [] };
        mockInsertReturning.mockResolvedValue([minimalApp]);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'I am very interested in this bounty.' }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.estimatedTime).toBe(0);
        expect(body.experienceLinks).toEqual([]);

        // Verify defaults were applied correctly
        expect(mockValues).toHaveBeenCalledWith({
            bountyId: 'bounty-1',
            applicantId: 'test-user-id',
            coverLetter: 'I am very interested in this bounty.',
            estimatedTime: 0,
            experienceLinks: [],
        });
    });

    it('should return 409 if the user has already applied to the bounty', async () => {
        mockFindFirst.mockResolvedValue(OPEN_BOUNTY);
        const duplicateError = new Error('duplicate key value') as any;
        duplicateError.code = '23505';
        mockInsertReturning.mockRejectedValue(duplicateError);

        const res = await app.request('/api/bounties/bounty-1/apply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer valid.token',
            },
            body: JSON.stringify({ cover_letter: 'Hello again' }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('You have already applied to this bounty');
    });
});
