import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { users, bounties, submissions, transactions } from '../db/schema';
import { eq, and, sum, desc, count } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const walletRouter = new Hono<{ Variables: Variables }>();

const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /api/wallet
 * Returns the authenticated user's wallet information:
 * - USDC balance (completed earnings)
 * - Pending earnings from approved submissions
 * - In-review earnings from pending submissions
 * - Recent transaction history
 */
walletRouter.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user's wallet info
    const [walletUser] = await db
        .select({
            walletAddress: users.walletAddress,
            totalEarned: users.totalEarned,
            bountiesCompleted: users.bountiesCompleted,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

    if (!walletUser) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Pending earnings from approved submissions
    const pendingResult = await db
        .select({ pendingAmount: sum(bounties.amountUsdc) })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(
            and(
                eq(submissions.developerId, user.id),
                eq(submissions.status, 'approved')
            )
        );

    // In-review earnings from pending submissions
    const inReviewResult = await db
        .select({ inReviewAmount: sum(bounties.amountUsdc) })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(
            and(
                eq(submissions.developerId, user.id),
                eq(submissions.status, 'pending')
            )
        );

    // Recent transactions (last 20)
    const recentTransactions = await db
        .select({
            id: transactions.id,
            type: transactions.type,
            amountUsdc: transactions.amountUsdc,
            status: transactions.status,
            bountyId: transactions.bountyId,
            stellarTxHash: transactions.stellarTxHash,
            createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.userId, user.id))
        .orderBy(desc(transactions.createdAt))
        .limit(20);

    return c.json({
        wallet: {
            address: walletUser.walletAddress,
            balance: walletUser.totalEarned,
            pending: pendingResult[0]?.pendingAmount ?? '0',
            inReview: inReviewResult[0]?.inReviewAmount ?? '0',
            bountiesCompleted: walletUser.bountiesCompleted,
        },
        recentTransactions,
    });
});

/**
 * GET /api/wallet/transactions
 * Returns paginated transaction history for the authenticated user.
 */
walletRouter.get(
    '/transactions',
    zValidator('query', paginationSchema),
    async (c) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const { page, limit } = c.req.valid('query');
        const offset = (page - 1) * limit;

        const results = await db
            .select({
                id: transactions.id,
                type: transactions.type,
                amountUsdc: transactions.amountUsdc,
                status: transactions.status,
                bountyId: transactions.bountyId,
                stellarTxHash: transactions.stellarTxHash,
                createdAt: transactions.createdAt,
                bounty: {
                    title: bounties.title,
                },
            })
            .from(transactions)
            .leftJoin(bounties, eq(transactions.bountyId, bounties.id))
            .where(eq(transactions.userId, user.id))
            .orderBy(desc(transactions.createdAt))
            .limit(limit)
            .offset(offset);

        const [totalCountResult] = await db
            .select({ count: count() })
            .from(transactions)
            .where(eq(transactions.userId, user.id));

        return c.json({
            data: results,
            meta: {
                total: totalCountResult.count,
                page,
                limit,
                totalPages: Math.ceil(totalCountResult.count / limit),
            },
        });
    }
);

export default walletRouter;
