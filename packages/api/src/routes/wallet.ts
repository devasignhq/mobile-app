import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { users, submissions, bounties, transactions } from '../db/schema';
import { eq, and, sum, desc, sql } from 'drizzle-orm';
import { StellarClient, NetworkType } from '../services/stellar';

const walletRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/wallet
 * Returns the authenticated user's current USDC balance from the Stellar
 * network plus calculated pending earnings from in-review submissions.
 */
walletRouter.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // 1. Fetch user record for wallet address
    const userRecord = await db.select({
        walletAddress: users.walletAddress,
    })
    .from(users)
    .where(eq(users.id, user.id));

    if (userRecord.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }

    const { walletAddress } = userRecord[0];

    // 2. Start fetching pending earnings concurrently (no dependency on Stellar call)
    const pendingEarningsPromise = db.select({
        total: sum(bounties.amountUsdc),
    })
    .from(submissions)
    .innerJoin(bounties, eq(submissions.bountyId, bounties.id))
    .where(
        and(
            eq(submissions.developerId, user.id),
            eq(submissions.status, 'pending')
        )
    ).catch(err => {
        console.error('[Wallet] Failed to fetch pending earnings:', err);
        return [];
    });

    // 3. Fetch USDC balance from Stellar network
    let balanceUsdc = '0';

    if (walletAddress) {
        const usdcIssuer = process.env.USDC_ASSET_ISSUER;
        if (!usdcIssuer) {
            return c.json({ error: 'USDC issuer not configured' }, 502);
        }

        try {
            const network = (process.env.STELLAR_NETWORK || 'TESTNET') as NetworkType;
            const stellarClient = new StellarClient(network);
            balanceUsdc = await stellarClient.getUsdcBalance(walletAddress, usdcIssuer);
        } catch (error) {
            console.error('[Wallet] Failed to fetch Stellar balance:', error);
            return c.json({ error: 'Failed to fetch balance from Stellar network' }, 502);
        }
    }

    // 4. Await pending earnings result
    const [pendingResult] = await pendingEarningsPromise;
    const pendingEarningsUsdc = pendingResult?.total != null ? String(pendingResult.total) : '0';

    return c.json({
        data: {
            walletAddress: walletAddress ?? null,
            balanceUsdc,
            pendingEarningsUsdc,
        },
    });
});

/**
 * GET /api/wallet/transactions
 * Returns the authenticated user's transaction history with pagination.
 */
walletRouter.get('/transactions', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);
    
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
        return c.json({ error: 'Invalid pagination parameters' }, 400);
    }

    const offset = (page - 1) * limit;

    const [totalCountResult, history] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
            .from(transactions)
            .where(eq(transactions.userId, user.id)),
        db.select({
            id: transactions.id,
            type: transactions.type,
            amount: transactions.amountUsdc,
            bountyId: transactions.bountyId,
            bountyTitle: bounties.title,
            stellarTxHash: transactions.stellarTxHash,
            status: transactions.status,
            timestamp: transactions.createdAt
        })
        .from(transactions)
        .leftJoin(bounties, eq(transactions.bountyId, bounties.id))
        .where(eq(transactions.userId, user.id))
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset(offset)
    ]);
    
    const total = Number(totalCountResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return c.json({
        data: history,
        meta: {
            page,
            limit,
            total,
            totalPages
        }
    });
});

export default walletRouter;
