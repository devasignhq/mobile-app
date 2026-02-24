import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBountyCreator, isBountyAssignee, isApplicationOwner, isSubmissionOwner, isExtensionRequestOwner, isBountyParticipant } from '../resource-auth';
import { db } from '../../db';
import { eq, and, or } from 'drizzle-orm';
import { bounties, applications, submissions, extensionRequests } from '../../db/schema';

// Mock the db object
vi.mock('../../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
    } as any,
}));

describe('Resource Authorization Helpers', () => {
    const userId = 'user-123';
    const resourceId = 'resource-456';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isBountyCreator', () => {
        it('should return true if user is the creator and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isBountyCreator(userId, resourceId);

            expect(result).toBe(true);
            // Assert that the where clause was called with the correct logic
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(bounties.id, resourceId),
                    eq(bounties.creatorId, userId)
                )
            );
        });

        it('should return false if user is not the creator', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isBountyCreator(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isBountyAssignee', () => {
        it('should return true if user is the assignee and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isBountyAssignee(userId, resourceId);

            expect(result).toBe(true);
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(bounties.id, resourceId),
                    eq(bounties.assigneeId, userId)
                )
            );
        });

        it('should return false if user is not the assignee', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isBountyAssignee(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isApplicationOwner', () => {
        it('should return true if user is the applicant and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isApplicationOwner(userId, resourceId);

            expect(result).toBe(true);
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(applications.id, resourceId),
                    eq(applications.applicantId, userId)
                )
            );
        });

        it('should return false if user is not the applicant', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isApplicationOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isSubmissionOwner', () => {
        it('should return true if user is the developer of the submission and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isSubmissionOwner(userId, resourceId);

            expect(result).toBe(true);
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(submissions.id, resourceId),
                    eq(submissions.developerId, userId)
                )
            );
        });

        it('should return false if user is not the developer of the submission', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isSubmissionOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isExtensionRequestOwner', () => {
        it('should return true if user is the developer of the extension request and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isExtensionRequestOwner(userId, resourceId);

            expect(result).toBe(true);
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(extensionRequests.id, resourceId),
                    eq(extensionRequests.developerId, userId)
                )
            );
        });

        it('should return false if user is not the developer of the extension request', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isExtensionRequestOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isBountyParticipant', () => {
        it('should return true if user is a participant (creator or assignee) and build the correct query', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([{ id: resourceId }])
            }));

            const result = await isBountyParticipant(userId, resourceId);

            expect(result).toBe(true);
            expect((db as any).where).toHaveBeenCalledWith(
                and(
                    eq(bounties.id, resourceId),
                    or(
                        eq(bounties.creatorId, userId),
                        eq(bounties.assigneeId, userId)
                    )
                )
            );
        });

        it('should return false if user is not a participant', async () => {
            (db as any).where.mockImplementation(() => ({
                limit: vi.fn().mockResolvedValueOnce([])
            }));
            const result = await isBountyParticipant(userId, resourceId);
            expect(result).toBe(false);
        });
    });
});
