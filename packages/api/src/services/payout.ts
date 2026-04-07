import { Keypair } from '@stellar/stellar-sdk';
import { StellarClient, NetworkType } from './stellar';
import { db } from '../db';
import { transactions, users } from '../db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

/**
 * Orchestrates the automatic payout from the platform escrow to the developer.
 * Uses exponential backoff for retries to handle transient errors such as
 * network drops or temporary Stellar Horizon rate limits.
 * 
 * @param transactionId - The ID of the pending payout transaction
 * @param developerId - The ID of the developer receiving the payment
 * @param amountUsdc - The amount of USDC to pay out
 */
export async function orchestratePayout(transactionId: string, developerId: string, amountUsdc: string) {
    try {
        console.log(`[Payout Orchestration] Started for transaction ${transactionId}, developer ${developerId}, amount ${amountUsdc} USDC`);
        
        let attempt = 0;
        let success = false;
        let errorMsg = '';
        let stellarTxHash = '';

        while (attempt < MAX_RETRIES && !success) {
            try {
                if (attempt > 0) {
                    const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
                    console.log(`[Payout Orchestration] Retry ${attempt} for ${transactionId} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                stellarTxHash = await executeStellarPayment(developerId, amountUsdc, transactionId);
                success = true;
            } catch (error: any) {
                attempt++;
                errorMsg = error instanceof Error ? error.message : String(error);
                console.warn(`[Payout Orchestration] Attempt ${attempt} failed for ${transactionId}:`, errorMsg);
            }
        }

        if (success) {
            await db.update(transactions)
                .set({
                    status: 'completed',
                    stellarTxHash: stellarTxHash,
                    updatedAt: new Date(),
                })
                .where(eq(transactions.id, transactionId));
            
            console.log(`[Payout Orchestration] Payment successful for transaction ${transactionId}, tx hash: ${stellarTxHash}`);
        } else {
            await db.update(transactions)
                .set({
                    status: 'failed',
                    updatedAt: new Date(),
                })
                .where(eq(transactions.id, transactionId));
                
            console.error(`[Payout Orchestration] Payment permanently failed for ${transactionId} after ${MAX_RETRIES} attempts. Last error: ${errorMsg}`);
        }

    } catch (e: any) {
        console.error(`[Payout Orchestration] Critical error during orchestratePayout for ${transactionId}:`, e);
    }
}

/**
 * Wraps the StellarClient call to actually send the funds from Platform Escrow.
 */
async function executeStellarPayment(developerId: string, amountUsdc: string, transactionId: string): Promise<string> {
    const escrowSecret = process.env.PLATFORM_ESCROW_SECRET;
    if (!escrowSecret) {
        throw new Error('PLATFORM_ESCROW_SECRET environment variable is not set');
    }

    const usdcIssuer = process.env.USDC_ASSET_ISSUER;
    if (!usdcIssuer) {
        throw new Error('USDC_ASSET_ISSUER environment variable is not set');
    }

    const network = (process.env.STELLAR_NETWORK || 'TESTNET') as NetworkType;
    const stellarClient = new StellarClient(network);

    const user = await db.query.users.findFirst({
        where: eq(users.id, developerId),
    });

    if (!user || !user.walletAddress) {
        throw new Error(`Developer ${developerId} not found or has no wallet address provisioned`);
    }

    const escrowKeypair = Keypair.fromSecret(escrowSecret);
    const destinationPublicKey = user.walletAddress;

    const memoText = transactionId.substring(0, 28);

    // Check if a payment with this transaction ID as memo has already been executed to this developer
    const existingTxs = await stellarClient.server.transactions()
        .forAccount(destinationPublicKey)
        .order('desc')
        .limit(20)
        .call();

    const alreadySentTx = existingTxs.records.find(tx => tx.memo === memoText);
    if (alreadySentTx) {
        console.log(`[Payout Orchestration] Idempotency: Found existing Stellar transaction for ${transactionId}`);
        return alreadySentTx.hash;
    }

    const result = await stellarClient.sendPayment(escrowKeypair, destinationPublicKey, amountUsdc, 'USDC', usdcIssuer, memoText);
    return result.hash;
}

export async function startPayoutSweeper() {
    console.log('[Payout Sweeper] initialized');
    // Run every 5 minutes
    setInterval(async () => {
        try {
            const pendingPayouts = await db.query.transactions.findMany({
                where: and(
                    eq(transactions.type, 'bounty_payout'),
                    or(
                        eq(transactions.status, 'pending'),
                        eq(transactions.status, 'pending_verification')
                    )
                )
            });

            for (const tx of pendingPayouts) {
                const lastActive = tx.updatedAt ? new Date(tx.updatedAt).getTime() : new Date(tx.createdAt).getTime();
                
                // If it's old enough (e.g., more than 5 minutes since last active), sweep it
                if (Date.now() - lastActive > 5 * 60 * 1000) {
                    console.log(`[Payout Sweeper] Recovering pending payout ${tx.id}`);
                    const updated = await db.update(transactions)
                        .set({ status: 'pending_verification', updatedAt: new Date() })
                        .where(and(
                            eq(transactions.id, tx.id),
                            eq(transactions.status, tx.status),
                            tx.updatedAt ? eq(transactions.updatedAt, tx.updatedAt) : isNull(transactions.updatedAt)
                        ))
                        .returning();
                        
                    if (updated.length > 0) {
                        // Execute asynchronously to prevent blocking the sweeper loop
                        orchestratePayout(tx.id, tx.userId, String(tx.amountUsdc)).catch(err => {
                            console.error(`[Payout Sweeper] Error orchestrating payout for ${tx.id}:`, err);
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[Payout Sweeper] Error sweeping pending payouts:', err);
        }
    }, 5 * 60 * 1000);
}
