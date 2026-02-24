import { eq, and, or } from 'drizzle-orm';
import { db } from '../db';
import { bounties, applications, submissions, extensionRequests } from '../db/schema';
import { Context, Next } from 'hono';
import { Variables } from './auth';

/**
 * Checks if a user is the creator of a specific bounty.
 */
export async function isBountyCreator(userId: string, bountyId: string): Promise<boolean> {
    const result = await db
        .select({ id: bounties.id })
        .from(bounties)
        .where(
            and(
                eq(bounties.id, bountyId),
                eq(bounties.creatorId, userId)
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Checks if a user is the assigned developer of a specific bounty.
 */
export async function isBountyAssignee(userId: string, bountyId: string): Promise<boolean> {
    const result = await db
        .select({ id: bounties.id })
        .from(bounties)
        .where(
            and(
                eq(bounties.id, bountyId),
                eq(bounties.assigneeId, userId)
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Checks if a user is the owner of a specific application.
 */
export async function isApplicationOwner(userId: string, applicationId: string): Promise<boolean> {
    const result = await db
        .select({ id: applications.id })
        .from(applications)
        .where(
            and(
                eq(applications.id, applicationId),
                eq(applications.applicantId, userId)
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Checks if a user is the owner (developer) of a specific submission.
 */
export async function isSubmissionOwner(userId: string, submissionId: string): Promise<boolean> {
    const result = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
            and(
                eq(submissions.id, submissionId),
                eq(submissions.developerId, userId)
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Checks if a user is the owner (developer) of a specific extension request.
 */
export async function isExtensionRequestOwner(userId: string, extensionRequestId: string): Promise<boolean> {
    const result = await db
        .select({ id: extensionRequests.id })
        .from(extensionRequests)
        .where(
            and(
                eq(extensionRequests.id, extensionRequestId),
                eq(extensionRequests.developerId, userId)
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Checks if a user is either the creator or the assignee of a bounty.
 * Useful for message threads or bounty-related actions.
 */
export async function isBountyParticipant(userId: string, bountyId: string): Promise<boolean> {
    const result = await db
        .select({ id: bounties.id })
        .from(bounties)
        .where(
            and(
                eq(bounties.id, bountyId),
                or(
                    eq(bounties.creatorId, userId),
                    eq(bounties.assigneeId, userId)
                )
            )
        )
        .limit(1);

    return result.length > 0;
}

/**
 * Hono Middleware Factories
 * These can be used directly in routes to enforce resource-level authorization.
 */

/**
 * Private higher-order function to create resource-level authorization middleware.
 */
function createResourceAuthMiddleware(
    checker: (userId: string, resourceId: string) => Promise<boolean>,
    paramName: string,
    errorMessage: string
) {
    return async (c: Context<{ Variables: Variables }>, next: Next) => {
        const user = c.get('user');
        const resourceId = c.req.param(paramName);

        if (!user) return c.json({ error: 'Unauthorized' }, 401);
        if (!resourceId) return c.json({ error: 'Resource ID missing' }, 400);

        if (!await checker(user.id, resourceId)) {
            return c.json({ error: errorMessage }, 403);
        }
        await next();
    };
}

export const ensureBountyCreator = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isBountyCreator, paramName, 'Forbidden: You must be the bounty creator');

export const ensureBountyAssignee = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isBountyAssignee, paramName, 'Forbidden: You must be the assigned developer');

export const ensureApplicationOwner = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isApplicationOwner, paramName, 'Forbidden: You must be the application owner');

export const ensureSubmissionOwner = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isSubmissionOwner, paramName, 'Forbidden: You must be the submission owner');

export const ensureExtensionRequestOwner = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isExtensionRequestOwner, paramName, 'Forbidden: You must be the extension request owner');

export const ensureBountyParticipant = (paramName: string = 'id') =>
    createResourceAuthMiddleware(isBountyParticipant, paramName, 'Forbidden: You must be a bounty participant');
