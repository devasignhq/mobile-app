import {
    Horizon,
    Keypair,
    TransactionBuilder,
    Operation,
    Asset,
    Networks,
    BASE_FEE,
} from '@stellar/stellar-sdk';

const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC_ISSUER_PUBLIC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';
const HORIZON_PUBLIC = 'https://horizon.stellar.org';

export type Network = 'testnet' | 'public';

export interface StellarClientConfig {
    network: Network;
    /** Secret key of the account that will fund new accounts and sign transactions. */
    signerSecret: string;
}

export class StellarClient {
    private server: Horizon.Server;
    private networkPassphrase: string;
    private signerKeypair: Keypair;
    private usdcAsset: Asset;

    constructor(config: StellarClientConfig) {
        const isTestnet = config.network === 'testnet';
        this.server = new Horizon.Server(isTestnet ? HORIZON_TESTNET : HORIZON_PUBLIC);
        this.networkPassphrase = isTestnet ? Networks.TESTNET : Networks.PUBLIC;
        this.signerKeypair = Keypair.fromSecret(config.signerSecret);
        this.usdcAsset = new Asset(
            'USDC',
            isTestnet ? USDC_ISSUER_TESTNET : USDC_ISSUER_PUBLIC,
        );
    }

    /**
     * Creates and funds a new Stellar account.
     * On testnet, uses the Friendbot faucet. On mainnet, funds from the signer account.
     *
     * @param startingBalance - Initial XLM balance in stroops (mainnet only); defaults to '10'
     * @returns The public key of the newly created account
     */
    async createAccount(startingBalance = '10'): Promise<string> {
        const newKeypair = Keypair.random();
        const publicKey = newKeypair.publicKey();

        if (this.networkPassphrase === Networks.TESTNET) {
            // Use Friendbot for testnet funding
            const response = await fetch(
                `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
            );
            if (!response.ok) {
                throw new Error(`Friendbot funding failed: ${response.statusText}`);
            }
        } else {
            // Fund from signer account on mainnet
            const signerAccount = await this.server.loadAccount(this.signerKeypair.publicKey());
            const tx = new TransactionBuilder(signerAccount, {
                fee: BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(
                    Operation.createAccount({
                        destination: publicKey,
                        startingBalance,
                    }),
                )
                .setTimeout(30)
                .build();

            tx.sign(this.signerKeypair);
            await this.server.submitTransaction(tx);
        }

        return publicKey;
    }

    /**
     * Sets up a USDC trustline on the given account.
     * The account must already exist and have sufficient XLM for the reserve.
     *
     * @param accountSecret - The secret key of the account to set up the trustline on
     */
    async setupTrustline(accountSecret: string): Promise<void> {
        const keypair = Keypair.fromSecret(accountSecret);
        const account = await this.server.loadAccount(keypair.publicKey());

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(
                Operation.changeTrust({
                    asset: this.usdcAsset,
                }),
            )
            .setTimeout(30)
            .build();

        tx.sign(keypair);
        await this.server.submitTransaction(tx);
    }

    /**
     * Sends a USDC payment from one account to another.
     *
     * @param senderSecret - Secret key of the sending account
     * @param destinationPublicKey - Public key of the recipient
     * @param amount - Amount of USDC to send (as a decimal string, e.g. '10.50')
     * @returns The transaction hash
     */
    async sendPayment(
        senderSecret: string,
        destinationPublicKey: string,
        amount: string,
    ): Promise<string> {
        const senderKeypair = Keypair.fromSecret(senderSecret);
        const senderAccount = await this.server.loadAccount(senderKeypair.publicKey());

        const tx = new TransactionBuilder(senderAccount, {
            fee: BASE_FEE,
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(
                Operation.payment({
                    destination: destinationPublicKey,
                    asset: this.usdcAsset,
                    amount,
                }),
            )
            .setTimeout(30)
            .build();

        tx.sign(senderKeypair);
        const result = await this.server.submitTransaction(tx);
        return result.hash;
    }

    /**
     * Retrieves the USDC balance for a given account public key.
     * Returns '0' if the account has no USDC trustline.
     *
     * @param publicKey - The Stellar public key of the account
     * @returns The USDC balance as a string
     */
    async getUsdcBalance(publicKey: string): Promise<string> {
        const account = await this.server.loadAccount(publicKey);
        const usdcBalance = account.balances.find(
            (b) =>
                b.asset_type === 'credit_alphanum4' &&
                (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === 'USDC' &&
                (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === this.usdcAsset.getIssuer(),
        );
        return usdcBalance ? usdcBalance.balance : '0';
    }
}

/**
 * Creates a StellarClient instance from environment variables.
 * Reads STELLAR_NETWORK ('testnet' | 'public', default: 'testnet')
 * and STELLAR_SIGNER_SECRET from the environment.
 */
export function createStellarClient(): StellarClient {
    const network = (process.env.STELLAR_NETWORK as Network) || 'testnet';
    const signerSecret = process.env.STELLAR_SIGNER_SECRET;
    if (!signerSecret) {
        throw new Error('STELLAR_SIGNER_SECRET environment variable is not set');
    }
    return new StellarClient({ network, signerSecret });
}
