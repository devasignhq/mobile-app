import { Horizon, Keypair, Networks, TransactionBuilder, Asset, Operation } from 'stellar-sdk';

export type NetworkType = 'TESTNET' | 'PUBLIC';

export class StellarClient {
    public server: Horizon.Server;
    public network: NetworkType;
    public networkPassphrase: string;

    constructor(network: NetworkType = 'TESTNET') {
        this.network = network;
        if (network === 'PUBLIC') {
            this.server = new Horizon.Server('https://horizon.stellar.org');
            this.networkPassphrase = Networks.PUBLIC;
        } else {
            this.server = new Horizon.Server('https://horizon-testnet.stellar.org');
            this.networkPassphrase = Networks.TESTNET;
        }
    }

    /**
     * Creates a new account.
     * On testnet, it can optionally use friendbot to fund the account if no sourceKeypair is provided.
     * On public, a sourceKeypair and startingBalance string are required.
     */
    async createAccount(newKeypair: Keypair, sourceKeypair?: Keypair, startingBalance: string = '10') {
        if (!sourceKeypair && this.network === 'TESTNET') {
            // Use Friendbot
            try {
                const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(newKeypair.publicKey())}`);
                if (!response.ok) {
                    throw new Error(`Friendbot request failed with status: ${response.status}`);
                }
                const responseJSON = await response.json();
                return responseJSON;
            } catch (e) {
                throw new Error(`Friendbot error: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        if (!sourceKeypair) {
            throw new Error('A source keypair is required to create an account on the public network.');
        }

        const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
        const transaction = new TransactionBuilder(sourceAccount, {
            fee: String(await this.server.fetchBaseFee()),
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(
                Operation.createAccount({
                    destination: newKeypair.publicKey(),
                    startingBalance,
                })
            )
            .setTimeout(30)
            .build();

        transaction.sign(sourceKeypair);
        return await this.server.submitTransaction(transaction);
    }

    /**
     * Sets up a trustline for a specific asset.
     */
    async setupTrustline(userKeypair: Keypair, assetCode: string, issuerPublicKey: string) {
        const asset = new Asset(assetCode, issuerPublicKey);
        const account = await this.server.loadAccount(userKeypair.publicKey());

        const transaction = new TransactionBuilder(account, {
            fee: String(await this.server.fetchBaseFee()),
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(
                Operation.changeTrust({
                    asset,
                })
            )
            .setTimeout(30)
            .build();

        transaction.sign(userKeypair);
        return await this.server.submitTransaction(transaction);
    }

    /**
     * Sends a payment using a specific asset or XLM (if asset is null).
     */
    async sendPayment(sourceKeypair: Keypair, destinationPublicKey: string, amount: string, assetCode?: string, issuerPublicKey?: string) {
        const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
        let asset = Asset.native();
        
        if (assetCode && issuerPublicKey) {
            asset = new Asset(assetCode, issuerPublicKey);
        }

        const transaction = new TransactionBuilder(sourceAccount, {
            fee: String(await this.server.fetchBaseFee()),
            networkPassphrase: this.networkPassphrase,
        })
            .addOperation(
                Operation.payment({
                    destination: destinationPublicKey,
                    asset,
                    amount,
                })
            )
            .setTimeout(30)
            .build();

        transaction.sign(sourceKeypair);
        return await this.server.submitTransaction(transaction);
    }

    /**
     * Retrieves the USDC balance for a given public key.
     */
    async getUsdcBalance(publicKey: string, usdcIssuer: string): Promise<string> {
        const account = await this.server.loadAccount(publicKey);
        const usdcBalance = account.balances.find(
            (b: any) => b.asset_type !== 'native' && 
            'asset_code' in b && b.asset_code === 'USDC' && 
            'asset_issuer' in b && b.asset_issuer === usdcIssuer
        );

        return usdcBalance ? usdcBalance.balance : '0';
    }
}
