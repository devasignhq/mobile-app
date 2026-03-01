import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock server instance — modified per-test
const mockServer = {
    loadAccount: vi.fn(),
    submitTransaction: vi.fn().mockResolvedValue({ hash: 'mock-tx-hash' }),
};

// Shared mock transaction chain
const mockTx = { sign: vi.fn() };
const mockBuild = vi.fn().mockReturnValue(mockTx);
const mockSetTimeout = vi.fn().mockReturnValue({ build: mockBuild });
const mockAddOperation = vi.fn().mockReturnValue({ setTimeout: mockSetTimeout });

vi.mock('@stellar/stellar-sdk', () => {
    // Use a proper constructor function (not arrow function)
    function MockHorizonServer() {
        return mockServer;
    }

    function MockTransactionBuilder() {
        return { addOperation: mockAddOperation };
    }

    function MockAsset() {
        return { getIssuer: () => 'mock-issuer' };
    }

    return {
        Horizon: { Server: MockHorizonServer },
        Keypair: {
            random: vi.fn().mockReturnValue({ publicKey: () => 'GENERATED_PUBLIC_KEY' }),
            fromSecret: vi.fn().mockReturnValue({ publicKey: () => 'SENDER_PUBLIC_KEY' }),
        },
        TransactionBuilder: MockTransactionBuilder,
        Operation: {
            createAccount: vi.fn().mockReturnValue({}),
            changeTrust: vi.fn().mockReturnValue({}),
            payment: vi.fn().mockReturnValue({}),
        },
        Asset: MockAsset,
        Networks: {
            TESTNET: 'Test SDF Network ; September 2015',
            PUBLIC: 'Public Global Stellar Network ; September 2015',
        },
        BASE_FEE: '100',
    };
});

import { StellarClient } from '../services/stellar';

const TESTNET_SIGNER_SECRET = 'SCZANGBA5INTS5OEBS4YRJVXNSMQP5ZTG7OHCCPWYNYGB6WFICXWUQKI';

describe('StellarClient', () => {
    let client: StellarClient;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer.loadAccount.mockReset();
        mockServer.submitTransaction.mockReset().mockResolvedValue({ hash: 'mock-tx-hash' });
        client = new StellarClient({ network: 'testnet', signerSecret: TESTNET_SIGNER_SECRET });
    });

    describe('createAccount', () => {
        it('should use Friendbot on testnet and return the new public key', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

            const pubKey = await client.createAccount();

            expect(pubKey).toBe('GENERATED_PUBLIC_KEY');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('friendbot.stellar.org'),
            );
        });

        it('should throw if Friendbot returns a non-ok response', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                statusText: 'Too Many Requests',
            }));
            await expect(client.createAccount()).rejects.toThrow('Friendbot funding failed');
        });
    });

    describe('setupTrustline', () => {
        it('should load the account and submit a ChangeTrust transaction', async () => {
            mockServer.loadAccount.mockResolvedValue({});
            mockServer.submitTransaction.mockResolvedValue({ hash: 'trustline-hash' });

            await client.setupTrustline(TESTNET_SIGNER_SECRET);

            expect(mockServer.loadAccount).toHaveBeenCalledWith('SENDER_PUBLIC_KEY');
            expect(mockServer.submitTransaction).toHaveBeenCalledOnce();
        });
    });

    describe('sendPayment', () => {
        it('should submit a payment transaction and return the hash', async () => {
            mockServer.loadAccount.mockResolvedValue({});
            mockServer.submitTransaction.mockResolvedValue({ hash: 'payment-hash-abc' });

            const hash = await client.sendPayment(
                TESTNET_SIGNER_SECRET,
                'GDESTINATION_PUBLIC_KEY',
                '50',
            );

            expect(hash).toBe('payment-hash-abc');
            expect(mockServer.submitTransaction).toHaveBeenCalledOnce();
        });
    });

    describe('getUsdcBalance', () => {
        it('should return the USDC balance when the trustline exists', async () => {
            mockServer.loadAccount.mockResolvedValue({
                balances: [
                    {
                        asset_type: 'credit_alphanum4',
                        asset_code: 'USDC',
                        asset_issuer: 'mock-issuer',
                        balance: '125.50',
                    },
                ],
            });

            const balance = await client.getUsdcBalance('GPUBLIC_KEY');
            expect(balance).toBe('125.50');
        });

        it('should return "0" when no USDC trustline exists', async () => {
            mockServer.loadAccount.mockResolvedValue({
                balances: [{ asset_type: 'native', balance: '10.0000000' }],
            });

            const balance = await client.getUsdcBalance('GPUBLIC_KEY');
            expect(balance).toBe('0');
        });
    });

    describe('public network', () => {
        it('should construct without error using the public network', () => {
            const publicClient = new StellarClient({
                network: 'public',
                signerSecret: TESTNET_SIGNER_SECRET,
            });
            expect(publicClient).toBeInstanceOf(StellarClient);
        });
    });
});
