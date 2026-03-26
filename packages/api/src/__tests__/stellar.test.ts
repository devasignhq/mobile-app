import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StellarClient } from '../services/stellar';
import { Keypair, Networks } from 'stellar-sdk';

// Mock stellar-sdk broadly
vi.mock('stellar-sdk', async (importOriginal) => {
    const actual = await importOriginal<typeof import('stellar-sdk')>();
    return {
        ...actual,
        Horizon: {
            Server: vi.fn().mockImplementation(function() {
                return {
                    loadAccount: vi.fn(),
                    fetchBaseFee: vi.fn().mockResolvedValue(100),
                    submitTransaction: vi.fn(),
                };
            }),
        },
        TransactionBuilder: vi.fn().mockImplementation(function() {
            const builder = {
                addOperation: vi.fn().mockReturnThis(),
                setTimeout: vi.fn().mockReturnThis(),
                build: vi.fn().mockReturnValue({
                    sign: vi.fn(),
                }),
            };
            return builder;
        }),
    };
});

// Polyfill fetch for Friendbot test if needed
global.fetch = vi.fn() as any;

describe('StellarClient', () => {
    let client: StellarClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new StellarClient('TESTNET');
    });

    it('initializes with correctly configured network parameters', () => {
        expect(client.networkPassphrase).toBe(Networks.TESTNET);
        const publicClient = new StellarClient('PUBLIC');
        expect(publicClient.networkPassphrase).toBe(Networks.PUBLIC);
    });

    it('creates account using friendbot on testnet when no source is provided', async () => {
        const mockResponse = { hash: 'mock-hash' };
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const newKeypair = Keypair.random();
        const result = await client.createAccount(newKeypair);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(`https://friendbot.stellar.org?addr=${encodeURIComponent(newKeypair.publicKey())}`)
        );
        expect(result).toEqual(mockResponse);
    });

    it('throws error when creating account on public network without a source keypair', async () => {
        const publicClient = new StellarClient('PUBLIC');
        const newKeypair = Keypair.random();
        
        await expect(publicClient.createAccount(newKeypair)).rejects.toThrow(
            'A source keypair is required to create an account on the public network.'
        );
    });

    it('creates an account securely with source keypair', async () => {
        const sourcePair = Keypair.random();
        const newPair = Keypair.random();

        // Setup mock account
        const mockAccount = { id: sourcePair.publicKey(), sequence: '1' };
        vi.mocked(client.server.loadAccount).mockResolvedValueOnce(mockAccount as any);
        vi.mocked(client.server.submitTransaction).mockResolvedValueOnce({ successful: true } as any);

        const result = await client.createAccount(newPair, sourcePair, '20');
        
        expect(client.server.loadAccount).toHaveBeenCalledWith(sourcePair.publicKey());
        expect(client.server.submitTransaction).toHaveBeenCalled();
        expect(result).toEqual({ successful: true });
    });

    it('sets up a trustline', async () => {
        const userPair = Keypair.random();
        const assetCode = 'USDC';
        const issuerId = Keypair.random().publicKey();

        const mockAccount = { id: userPair.publicKey(), sequence: '1' };
        vi.mocked(client.server.loadAccount).mockResolvedValueOnce(mockAccount as any);
        vi.mocked(client.server.submitTransaction).mockResolvedValueOnce({ successful: true } as any);

        const result = await client.setupTrustline(userPair, assetCode, issuerId);

        expect(client.server.loadAccount).toHaveBeenCalledWith(userPair.publicKey());
        expect(client.server.submitTransaction).toHaveBeenCalled();
        expect(result).toEqual({ successful: true });
    });

    it('sends payment successfully', async () => {
        const sourcePair = Keypair.random();
        const destId = Keypair.random().publicKey();

        const mockAccount = { id: sourcePair.publicKey(), sequence: '1' };
        vi.mocked(client.server.loadAccount).mockResolvedValueOnce(mockAccount as any);
        vi.mocked(client.server.submitTransaction).mockResolvedValueOnce({ hash: 'payment-hash', successful: true } as any);

        const result = await client.sendPayment(sourcePair, destId, '50.0');

        expect(client.server.loadAccount).toHaveBeenCalledWith(sourcePair.publicKey());
        expect(client.server.submitTransaction).toHaveBeenCalled();
        expect(result).toEqual({ hash: 'payment-hash', successful: true });
    });

    it('gets the USDC balance from an account correctly', async () => {
        const publicKey = Keypair.random().publicKey();
        const issuerPublic = Keypair.random().publicKey();

        const mockAccount = {
            id: publicKey,
            balances: [
                { asset_type: 'native', balance: '100.0000000' },
                { asset_type: 'credit_alphanum4', asset_code: 'OTHER', asset_issuer: issuerPublic, balance: '5.0' },
                { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: issuerPublic, balance: '25.50' }
            ]
        };
        vi.mocked(client.server.loadAccount).mockResolvedValueOnce(mockAccount as any);

        const balance = await client.getUsdcBalance(publicKey, issuerPublic);
        expect(client.server.loadAccount).toHaveBeenCalledWith(publicKey);
        expect(balance).toBe('25.50');
    });

    it('returns "0" if USDC balance does not exist', async () => {
        const publicKey = Keypair.random().publicKey();
        const issuerPublic = Keypair.random().publicKey();

        const mockAccount = {
            id: publicKey,
            balances: [
                { asset_type: 'native', balance: '100.0000000' }
            ]
        };
        vi.mocked(client.server.loadAccount).mockResolvedValueOnce(mockAccount as any);

        const balance = await client.getUsdcBalance(publicKey, issuerPublic);
        expect(balance).toBe('0');
    });
});
