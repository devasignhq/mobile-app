import { Keypair } from '@stellar/stellar-sdk';
import { StellarClient, NetworkType } from './stellar';
import { db } from '../db';
import { transactions, users } from '../db/schema';
import { eq } from 'drizzle-orm';

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

                stellarTxHash = await executeStellarPayment(developerId, amountUsdc);
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
async function executeStellarPayment(developerId: string, amountUsdc: string): Promise<string> {
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

    const result = await stellarClient.sendPayment(escrowKeypair, destinationPublicKey, amountUsdc, 'USDC', usdcIssuer);
    return result.hash;
}
