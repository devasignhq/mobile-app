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

describe('POST /api/submissions/:id/dispute', () => {
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

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer invalid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Valid dispute' })
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 for invalid request body', async () => {
        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ evidence_links: ['not-a-url'] })
        });

        expect(res.status).toBe(400);
    });

    it('should return 404 if submission is not found or not owned by user', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Valid reason' })
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Submission not found');
    });

    it('should return 400 if submission is not rejected', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ status: 'approved' }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Valid reason' })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Only rejected submissions can be disputed');
    });

    it('should return 400 if a dispute already exists', async () => {
        // First db.select() -> finding the submission
        const mockSubmissionWhere = vi.fn().mockResolvedValue([{ id: 'sub-id', status: 'rejected' }]);
        const mockSubmissionFrom = vi.fn().mockReturnValue({ where: mockSubmissionWhere });

        // Second db.select() -> checking for existing disputes
        const mockDisputeWhere = vi.fn().mockResolvedValue([{ id: 'existing-dispute' }]);
        const mockDisputeFrom = vi.fn().mockReturnValue({ where: mockDisputeWhere });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockSubmissionFrom } as any)
            .mockReturnValueOnce({ from: mockDisputeFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Valid reason' })
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('A dispute already exists for this submission');
    });

    it('should successfully create a dispute and update status', async () => {
        const mockSubmissionWhere = vi.fn().mockResolvedValue([{ id: 'sub-id', status: 'rejected' }]);
        const mockSubmissionFrom = vi.fn().mockReturnValue({ where: mockSubmissionWhere });

        const mockDisputeWhere = vi.fn().mockResolvedValue([]);
        const mockDisputeFrom = vi.fn().mockReturnValue({ where: mockDisputeWhere });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockSubmissionFrom } as any)
            .mockReturnValueOnce({ from: mockDisputeFrom } as any);

        // Mock database transaction
        const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: 'sub-id' }]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        const mockInsertReturning = vi.fn().mockResolvedValue([{ id: 'new-dispute-id', submissionId: 'sub-id', reason: 'Unfair rejection', status: 'open' }]);
        const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
        const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

        // We temporarily mock db.transaction on the db object since db.transaction is untyped mocking usually
        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate,
                insert: mockInsert
            });
        });

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Unfair rejection', evidence_links: ['https://example.com'] })
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.data.id).toBe('new-dispute-id');
        expect(body.data.reason).toBe('Unfair rejection');
        expect(body.data.status).toBe('open');

        // Restore original transaction just in case
        vi.restoreAllMocks();
    });

    it('should return 409 if submission is modified concurrently', async () => {
        const mockSubmissionWhere = vi.fn().mockResolvedValue([{ id: 'sub-id', status: 'rejected' }]);
        const mockSubmissionFrom = vi.fn().mockReturnValue({ where: mockSubmissionWhere });

        const mockDisputeWhere = vi.fn().mockResolvedValue([]);
        const mockDisputeFrom = vi.fn().mockReturnValue({ where: mockDisputeWhere });

        vi.mocked(db.select)
            .mockReturnValueOnce({ from: mockSubmissionFrom } as any)
            .mockReturnValueOnce({ from: mockDisputeFrom } as any);

        // Mock database transaction to simulate concurrent modification (0 rows updated)
        const mockUpdateReturning = vi.fn().mockResolvedValue([]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate,
                rollback: () => { throw new Error('Rollback'); }
            });
        });

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/dispute', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Unfair rejection' })
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('Failed to create dispute or submission was modified concurrently');
    });
});

describe('POST /api/submissions/:id/approve', () => {
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

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid.token' }
        });

        expect(res.status).toBe(401);
    });

    it('should return 404 if submission is not found', async () => {
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' }
        });

        expect(res.status).toBe(404);
    });

    it('should return 403 if user is not the bounty creator', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ 
            submission: { id: 's-1', status: 'pending' }, 
            bounty: { id: 'b-1', creatorId: 'different-user' } 
        }]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' }
        });

        expect(res.status).toBe(403);
    });
    
    it('should return 400 if submission is not pending or disputed', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ 
            submission: { id: 's-1', status: 'rejected' }, 
            bounty: { id: 'b-1', creatorId: 'test-user-id' } 
        }]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' }
        });

        expect(res.status).toBe(400);
    });

    it('should successfully approve submission and trigger payment', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ 
            submission: { id: '123e4567-e89b-12d3-a456-426614174000', status: 'pending', developerId: 'dev-1' }, 
            bounty: { id: 'b-1', creatorId: 'test-user-id', amountUsdc: '100.00' } 
        }]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-426614174000' }]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        const mockInsertValues = vi.fn().mockResolvedValue([{ id: 'mock-tx-id' }]);
        const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({
                update: mockUpdate,
                insert: mockInsert
            });
        });

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/approve', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token' }
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Submission approved and payment triggered successfully');
        
        // Restore transaction
        vi.restoreAllMocks();
    });
});

describe('POST /api/submissions/:id/reject', () => {
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

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/reject', {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'reason' })
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 for missing rejection reason', async () => {
        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/reject', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        expect(res.status).toBe(400);
    });

    it('should return 403 if user is not the bounty creator', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ 
            submission: { id: 's-1', status: 'pending' }, 
            bounty: { id: 'b-1', creatorId: 'different-user' } 
        }]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/reject', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'reason' })
        });

        expect(res.status).toBe(403);
    });

    it('should successfully reject submission', async () => {
        const mockWhere = vi.fn().mockResolvedValue([{ 
            submission: { id: '123e4567-e89b-12d3-a456-426614174000', status: 'pending' }, 
            bounty: { id: 'b-1', creatorId: 'test-user-id' } 
        }]);
        const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-426614174000' }]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

        db.transaction = vi.fn().mockImplementation(async (cb) => {
            return cb({ update: mockUpdate });
        });

        const res = await app.request('/api/submissions/123e4567-e89b-12d3-a456-426614174000/reject', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid.token', 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejection_reason: 'Does not meet requirements.' })
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe('Submission rejected successfully');
    });
});
