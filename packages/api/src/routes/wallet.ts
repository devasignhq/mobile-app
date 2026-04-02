import { Hono } from 'hono';
import { StrKey, Keypair } from '@stellar/stellar-sdk';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { users, submissions, bounties, transactions } from '../db/schema';
import { eq, and, sum, desc, sql, gt } from 'drizzle-orm';
import { StellarClient, NetworkType } from '../services/stellar';
import { decryptWalletSecret } from '../utils/encryption';

const walletRouter = new Hono<{ Variables: Variables }>();

/** Minimum hours between consecutive withdrawals. */
const WITHDRAWAL_COOLDOWN_HOURS = 24;

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

/**
 * POST /api/wallet/withdraw
 * Processes a USDC withdrawal from the user's platform wallet to an external
 * Stellar address. Validates balance, destination, trustline, and cooldown.
 */
walletRouter.post('/withdraw', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // --- 1. Validate request body ---
    let body: { destinationAddress?: string; amount?: string };
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { destinationAddress, amount } = body;

    if (!destinationAddress || typeof destinationAddress !== 'string') {
        return c.json({ error: 'destinationAddress is required' }, 400);
    }

    if (!amount || typeof amount !== 'string') {
        return c.json({ error: 'amount is required' }, 400);
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return c.json({ error: 'amount must be a positive number' }, 400);
    }

    // Validate max 7 decimal places (Stellar precision)
    const decimalParts = amount.split('.');
    if (decimalParts.length === 2 && decimalParts[1].length > 7) {
        return c.json({ error: 'amount must have at most 7 decimal places' }, 400);
    }

    // --- 2. Fetch user record ---
    const userRecord = await db.select({
        walletAddress: users.walletAddress,
        walletSecretEnc: users.walletSecretEnc,
    })
    .from(users)
    .where(eq(users.id, user.id));

    if (userRecord.length === 0) {
        return c.json({ error: 'User not found' }, 404);
    }

    const { walletAddress, walletSecretEnc } = userRecord[0];

    if (!walletAddress || !walletSecretEnc) {
        return c.json({ error: 'No wallet provisioned for this account' }, 400);
    }

    // --- 3. Validate destination address ---
    if (!StrKey.isValidEd25519PublicKey(destinationAddress)) {
        return c.json({ error: 'Invalid destination Stellar address' }, 400);
    }

    if (destinationAddress === walletAddress) {
        return c.json({ error: 'Cannot withdraw to your own platform wallet' }, 400);
    }

    // --- 4. Enforce withdrawal cooldown & create pending transaction ---
    let pendingTx;
    try {
        pendingTx = await db.transaction(async (tx) => {
            // Lock user record to serialize concurrent requests
            await tx.select({ id: users.id })
                .from(users)
                .where(eq(users.id, user.id))
                .for('update');
                
            // Check for any active pending withdrawals to prevent overlapping
            const activePending = await tx.select({ id: transactions.id })
                .from(transactions)
                .where(and(
                    eq(transactions.userId, user.id),
                    eq(transactions.type, 'withdrawal'),
                    eq(transactions.status, 'pending')
                ))
                .limit(1);
                
            if (activePending.length > 0) {
                throw new Error('PENDING_EXISTS');
            }

            // Verify cooldown under lock
            const cooldownCutoff = new Date(Date.now() - WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000);
            const recentWithdrawals = await tx.select({
                createdAt: transactions.createdAt,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.userId, user.id),
                    eq(transactions.type, 'withdrawal'),
                    gt(transactions.createdAt, cooldownCutoff)
                )
            )
            .orderBy(desc(transactions.createdAt))
            .limit(1);

            if (recentWithdrawals.length > 0) {
                const lastWithdrawal = recentWithdrawals[0].createdAt;
                const retryAfter = new Date(lastWithdrawal.getTime() + WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000);
                throw new Error(`COOLDOWN:${retryAfter.toISOString()}`);
            }

            // Insert pending transaction record
            const [insertedTx] = await tx.insert(transactions).values({
                userId: user.id,
                type: 'withdrawal',
                amountUsdc: amount,
                status: 'pending',
            }).returning({
                id: transactions.id,
                createdAt: transactions.createdAt,
            });
            
            return insertedTx;
        });
    } catch (error: any) {
        if (error.message === 'PENDING_EXISTS') {
            return c.json({ error: 'You already have a pending withdrawal. Please wait for it to complete.' }, 409);
        }
        if (error.message.startsWith('COOLDOWN:')) {
            return c.json({
                error: 'Withdrawal cooldown active. Please try again later.',
                retryAfter: error.message.split(':')[1],
            }, 429);
        }
        throw error;
    }

    // Helper to gracefully fail the pending transaction on validation error
    const completeAsFailed = async () => {
        await db.update(transactions)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(transactions.id, pendingTx.id));
    };

    // --- 5. Validate environment ---
    const usdcIssuer = process.env.USDC_ASSET_ISSUER;
    if (!usdcIssuer) {
        await completeAsFailed();
        return c.json({ error: 'USDC issuer not configured' }, 502);
    }

    const network = (process.env.STELLAR_NETWORK || 'TESTNET') as NetworkType;
    const stellarClient = new StellarClient(network);

    // --- 6. Validate destination trustline ---
    try {
        const destAccount = await stellarClient.server.loadAccount(destinationAddress);
        const hasTrustline = destAccount.balances.some(
            (b: any) =>
                (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
                b.asset_code === 'USDC' &&
                b.asset_issuer === usdcIssuer
        );
        if (!hasTrustline) {
            await completeAsFailed();
            return c.json({ error: 'Destination account does not have a USDC trustline' }, 400);
        }
    } catch (error: any) {
        await completeAsFailed();
        if (error?.response?.status === 404) {
            return c.json({ error: 'Destination account not found on Stellar network' }, 400);
        }
        console.error('[Wallet Withdraw] Failed to load destination account:', error);
        return c.json({ error: 'Failed to validate destination account' }, 502);
    }

    // --- 7. Check sufficient balance ---
    let currentBalance: string;
    try {
        currentBalance = await stellarClient.getUsdcBalance(walletAddress, usdcIssuer);
    } catch (error) {
        await completeAsFailed();
        console.error('[Wallet Withdraw] Failed to fetch balance:', error);
        return c.json({ error: 'Failed to fetch balance from Stellar network' }, 502);
    }

    if (parseFloat(currentBalance) < parsedAmount) {
        await completeAsFailed();
        return c.json({
            error: 'Insufficient USDC balance',
            available: currentBalance,
            requested: amount,
        }, 400);
    }

    // --- 8. Decrypt wallet secret ---
    let sourceKeypair: Keypair;
    try {
        const secret = decryptWalletSecret(walletSecretEnc);
        sourceKeypair = Keypair.fromSecret(secret);
    } catch (error) {
        await completeAsFailed();
        console.error('[Wallet Withdraw] Failed to decrypt wallet secret:', error);
        return c.json({ error: 'Failed to process wallet credentials' }, 500);
    }

    // --- 10. Submit Stellar payment ---
    try {
        const result = await stellarClient.sendPayment(
            sourceKeypair,
            destinationAddress,
            amount,
            'USDC',
            usdcIssuer,
        );

        const txHash = (result as any).hash || (result as any).id || null;

        // Update transaction to completed
        await db.update(transactions)
            .set({
                status: 'completed',
                stellarTxHash: txHash,
                updatedAt: new Date(),
            })
            .where(eq(transactions.id, pendingTx.id));

        return c.json({
            data: {
                transactionId: pendingTx.id,
                status: 'completed',
                stellarTxHash: txHash,
                amount,
                destinationAddress,
                createdAt: pendingTx.createdAt,
            },
        });
    } catch (error: any) {
        console.error('[Wallet Withdraw] Stellar payment failed:', error);

        const isAmbiguous = !error.response || error.response?.status >= 500;

        if (isAmbiguous) {
            // Ambiguous failure (e.g. timeout) - mark as pending_verification
            await db.update(transactions)
                .set({
                    status: 'pending_verification',
                    updatedAt: new Date(),
                })
                .where(eq(transactions.id, pendingTx.id));

            return c.json({
                error: 'Withdrawal submission timed out or is unknown. It may still complete.',
                transactionId: pendingTx.id,
                status: 'pending_verification'
            }, 502);
        }

        await completeAsFailed();

        return c.json({
            error: 'Withdrawal failed. The Stellar payment could not be processed.',
            transactionId: pendingTx.id,
        }, 400);
    }
});

export default walletRouter;
