import { Keypair } from '@stellar/stellar-sdk';
import { StellarClient, NetworkType } from './stellar';
import { encryptWalletSecret, decryptWalletSecret } from '../utils/encryption';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Provisions a Stellar wallet for a newly registered user.
 *
 * Steps:
 * 1. Generate a random Stellar keypair
 * 2. Encrypt the secret key and store both keys in the database
 * 3. Fund the new account from the platform escrow with minimum XLM
 * 4. Set up a USDC trustline on the new account
 *
 * @param userId - The UUID of the user to provision a wallet for
 * @returns The public key of the newly provisioned wallet
 * @throws If any step fails (missing env vars, Stellar network errors, DB errors)
 */
export async function provisionWallet(userId: string): Promise<string> {
    // Validate required environment variables
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

    // 1. Fetch current user to check for existing keys
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
    });

    if (!user) {
        throw new Error(`User ${userId} not found`);
    }

    let keypair: Keypair;
    
    if (user.walletAddress && user.walletSecretEnc) {
        // Reuse existing keys
        const secret = decryptWalletSecret(user.walletSecretEnc);
        keypair = Keypair.fromSecret(secret);
    } else {
        // 1a. Generate a new keypair if none exists
        keypair = Keypair.random();
        
        // 2. Encrypt the secret key and store in DB FIRST to prevent loss of funds
        const encryptedSecret = encryptWalletSecret(keypair.secret());

        await db.update(users)
            .set({
                walletAddress: keypair.publicKey(),
                walletSecretEnc: encryptedSecret,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));
    }

    const escrowKeypair = Keypair.fromSecret(escrowSecret);

    let hasTrustline = false;

    // 3. Create and fund the account from platform escrow ONLY if it doesn't exist
    try {
        const account = await stellarClient.server.loadAccount(keypair.publicKey());
        hasTrustline = account.balances.some((b: any) => b.asset_code === 'USDC' && b.asset_issuer === usdcIssuer);
        console.log(`[Wallet Provisioning] Account ${keypair.publicKey()} already exists on ${network}. Skipping creation.`);
    } catch (err: any) {
        if (err.response?.status === 404) {
            console.log(`[Wallet Provisioning] Creating and funding account ${keypair.publicKey()} on ${network}...`);
            const startingBalance = '3'; // Enough for base reserve (1 XLM) + trustline reserve (0.5 XLM) + fees
            await stellarClient.createAccount(keypair, escrowKeypair, startingBalance);
        } else {
            throw err;
        }
    }

    // 4. Set up USDC trustline only if it doesn't already exist
    if (!hasTrustline) {
        await stellarClient.setupTrustline(keypair, 'USDC', usdcIssuer);
    }

    console.log(`[Wallet Provisioning] Successfully provisioned/verified wallet for user ${userId}: ${keypair.publicKey()}`);

    return keypair.publicKey();
}
