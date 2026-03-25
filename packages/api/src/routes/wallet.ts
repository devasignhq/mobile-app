import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { users, bounties, submissions, transactions } from '../db/schema';
import { eq, and, sum, desc } from 'drizzle-orm';

const walletRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/wallet
 * Returns the authenticated user's wallet information:
 * - USDC balance (completed earnings)
 * - Pending earnings from in-review/approved submissions
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

    // Calculate pending earnings from submissions that are approved but not yet paid out
    const pendingResult = await db
        .select({
            pendingAmount: sum(bounties.amountUsdc),
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(
            and(
                eq(submissions.developerId, user.id),
                eq(submissions.status, 'approved')
            )
        );

    // Calculate in-review earnings (submitted but not yet approved)
    const inReviewResult = await db
        .select({
            inReviewAmount: sum(bounties.amountUsdc),
        })
        .from(submissions)
        .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
        .where(
            and(
                eq(submissions.developerId, user.id),
                eq(submissions.status, 'pending')
            )
        );

    const pendingAmount = pendingResult[0]?.pendingAmount ?? '0';
    const inReviewAmount = inReviewResult[0]?.inReviewAmount ?? '0';

    // Get recent transactions (last 20)
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
            pending: pendingAmount,
            inReview: inReviewAmount,
            bountiesCompleted: walletUser.bountiesCompleted,
        },
        recentTransactions,
    });
});

export default walletRouter;
