import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        select: vi.fn(),
    },
}));

describe('GET /api/submissions/mine', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/submissions/mine', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer invalid.token'
            },
        });

        expect(res.status).toBe(401);
    });

    it('should fail with 400 for invalid pagination parameters', async () => {
        const res = await app.request('/api/submissions/mine?page=-1&limit=200', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(400);
    });

    it('should successfully return paginated submissions', async () => {
        const mockSubmissions = [
            { id: 's-1', prUrl: 'http://pr1', status: 'pending', createdAt: new Date('2026-03-19'), bounty: { id: 'b-1', title: 'Bounty 1' } },
            { id: 's-2', prUrl: 'http://pr2', status: 'approved', createdAt: new Date('2026-03-18'), bounty: { id: 'b-2', title: 'Bounty 2' } }
        ];

        // Mock the query chain
        const mockOffset = vi.fn().mockResolvedValue(mockSubmissions);
        const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere1 = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockJoin = vi.fn().mockReturnValue({ where: mockWhere1 });
        const mockFrom1 = vi.fn().mockReturnValue({ innerJoin: mockJoin });

        const mockWhere2 = vi.fn().mockResolvedValue([{ count: 2 }]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        vi.mocked(db.select).mockImplementation((...args) => {
            // Check if it's the count query or the main query
            // The first select is the main query, second is count. We can differentiate by context inside the endpoint.
            // But an easier way is to just return a builder that handles both.
            // For simplicity, we just mock it to return an object that works for both.
            // When we do db.select({...}).from(...).innerJoin, it's the first query
            // When we do db.select({id: ...}).from(...).where, it's the second query.
            return {
                from: (table: any) => {
                    return {
                        innerJoin: mockJoin,
                        // This handles the totalCountResult query
                        where: mockWhere2,
                    };
                }
            } as any;
        });

        const res = await app.request('/api/submissions/mine?page=1&limit=10', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toHaveLength(2);
        expect(body.data[0].bounty.title).toBe('Bounty 1');
        expect(body.meta.total).toBe(2);
        expect(body.meta.page).toBe(1);
        expect(body.meta.limit).toBe(10);
        expect(body.meta.totalPages).toBe(1);
    });
});

describe('POST /api/submissions/:id/dispute', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer invalid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'This is not fair' }),
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 for invalid UUID', async () => {
        const res = await app.request('/api/submissions/not-a-uuid/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'This is not fair' }),
        });

        expect(res.status).toBe(400);
    });

    it('should return 400 if reason is missing', async () => {
        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(400);
    });

    it('should return 404 if submission not found', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'This is not fair' }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Submission not found');
    });

    it('should return 400 if submission is not rejected', async () => {
        const mockSubmission = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'pending',
            developerId: 'test-user-id',
        };

        const mockWhere = vi.fn().mockResolvedValue([mockSubmission]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'This is not fair' }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Only rejected submissions can be disputed');
    });

    it('should return 409 if dispute already exists', async () => {
        const mockSubmission = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'rejected',
            developerId: 'test-user-id',
        };
        const mockExistingDispute = { id: 'd-1', submissionId: '123e4567-e89b-12d3-a456-426614174000' };

        const mockWhere2 = vi.fn().mockResolvedValue([mockExistingDispute]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        const mockWhere1 = vi.fn().mockResolvedValue([mockSubmission]);
        const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

        let callCount = 0;
        vi.mocked(db.select).mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { from: mockFrom1 } as any;
            return { from: mockFrom2 } as any;
        });

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason: 'This is not fair' }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('A dispute already exists for this submission');
    });

    it('should create a dispute and return 201', async () => {
        const mockSubmission = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'rejected',
            developerId: 'test-user-id',
        };

        const mockNewDispute = {
            id: 'new-dispute-id',
            submissionId: '123e4567-e89b-12d3-a456-426614174000',
            reason: 'The code compiles fine on CI',
            evidenceLinks: ['https://github.com/example/runs/123'],
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Mock for submission lookup
        const mockWhere1 = vi.fn().mockResolvedValue([mockSubmission]);
        const mockFrom1 = vi.fn().mockReturnValue({ where: mockWhere1 });

        // Mock for existing dispute check (returns empty - no existing dispute)
        const mockWhere2 = vi.fn().mockResolvedValue([]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere2 });

        // Mock for transaction
        const mockReturning = vi.fn().mockResolvedValue([mockNewDispute]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

        const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(null) });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

        const mockTransaction = vi.fn().mockImplementation(async (callback: any) => {
            return callback({
                insert: mockInsert,
                update: mockUpdate,
            });
        });

        let selectCallCount = 0;
        vi.mocked(db.select).mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) return { from: mockFrom1 } as any;
            return { from: mockFrom2 } as any;
        });

        (db as any).transaction = mockTransaction;

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reason: 'The code compiles fine on CI',
                evidence_links: ['https://github.com/example/runs/123'],
            }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.id).toBe('new-dispute-id');
        expect(body.data.status).toBe('open');
        expect(body.data.reason).toBe('The code compiles fine on CI');
    });
});

describe('GET /api/submissions/:id', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer invalid.token'
            },
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 for invalid UUID', async () => {
        const res = await app.request('/api/submissions/invalid-id', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(400);
    });

    it('should return 404 if submission is not found', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Submission not found');
    });

    it('should return 404 if attempting to access another user\'s submission (IDOR protection)', async () => {
        // Query will return empty array because of the added `eq(submissions.developerId, user.id)` clause
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Submission not found');
    });

    it('should return submission details with dispute', async () => {
        const mockSubmission = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'rejected',
            rejectionReason: 'Code does not compile'
        };
        const mockDispute = {
            id: 'd-1',
            reason: 'It compiles on my machine',
            status: 'open'
        };

        const mockWhere = vi.fn().mockResolvedValue([{ submission: mockSubmission, dispute: mockDispute }]);
        const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.id).toBe(mockSubmission.id);
        expect(body.data.rejectionReason).toBe('Code does not compile');
        expect(body.data.dispute.id).toBe('d-1');
        expect(body.data.dispute.reason).toBe('It compiles on my machine');
    });

    it('should return submission details without dispute', async () => {
        const mockSubmission = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'approved',
        };

        const mockWhere = vi.fn().mockResolvedValue([{ submission: mockSubmission, dispute: null }]);
        const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });

        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer valid.token'
            },
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.id).toBe(mockSubmission.id);
        expect(body.data.status).toBe('approved');
        expect(body.data.dispute).toBeNull();
    });
});
