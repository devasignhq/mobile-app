/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { Keypair } from '@stellar/stellar-sdk';

// Hoist mock functions
const {
    mockGetUsdcBalance,
    mockSendPayment,
    mockLoadAccount,
    mockDecryptWalletSecret,
} = vi.hoisted(() => ({
    mockGetUsdcBalance: vi.fn(),
    mockSendPayment: vi.fn(),
    mockLoadAccount: vi.fn(),
    mockDecryptWalletSecret: vi.fn(),
}));

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

/**
 * We mock the db using a chainable object that records calls.
 * Each test configures `selectResults` — an ordered array of resolved values,
 * one per db.select() call in the handler.
 */
let selectResults: any[][] = [];
let selectCallIndex = 0;

let insertReturningValue: any = { id: 'tx-123', createdAt: new Date() };
const mockUpdateWhere = vi.fn().mockResolvedValue([]);
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

// Build a fully chainable mock object for db.select()
function createSelectChain(result: any[]) {
    const chain: any = {};
    const resolve = () => Promise.resolve(result);
    // Every method returns `chain` to allow arbitrary chaining, except
    // terminal methods (where/limit/offset) which may be the last in chain
    // and need to resolve. We can't know which is last, so each one both
    const methods = ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'for'];
    for (const m of methods) {
        chain[m] = vi.fn((..._args: any[]) => chain);
    }
    // Make chain thennable so `await` works at any point in the chain
    chain.then = (resolve_: any, reject_: any) => Promise.resolve(result).then(resolve_, reject_);
    chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
    chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
    return chain;
}

vi.mock('../db', () => {
    const mockDb: any = {
        select: vi.fn((..._args: any[]) => {
            const idx = selectCallIndex++;
            const result = selectResults[idx] ?? [];
            return createSelectChain(result);
        }),
        insert: vi.fn(() => ({
            values: vi.fn(() => ({
                returning: vi.fn(() => Promise.resolve([insertReturningValue])),
            })),
        })),
        update: vi.fn(() => ({
            set: mockUpdateSet,
        })),
    };
    mockDb.transaction = vi.fn(async (cb: any) => cb(mockDb));
    return { db: mockDb };
});

// Mock StellarClient
vi.mock('../services/stellar', () => ({
    StellarClient: vi.fn(function () {
        return {
            getUsdcBalance: mockGetUsdcBalance,
            sendPayment: mockSendPayment,
            server: {
                loadAccount: mockLoadAccount,
            },
        };
    }),
}));

// Mock encryption
vi.mock('../utils/encryption', () => ({
    decryptWalletSecret: mockDecryptWalletSecret,
}));

const MOCK_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const validDestination = Keypair.random().publicKey();
const testKeypair = Keypair.random();

function makeRequest(app: any, body: any) {
    return app.request('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer valid.token',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

describe('POST /api/wallet/withdraw', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
        process.env.USDC_ASSET_ISSUER = MOCK_USDC_ISSUER;
        process.env.STELLAR_NETWORK = 'TESTNET';
        process.env.WALLET_ENCRYPTION_KEY = 'a'.repeat(64);
    });

    beforeEach(() => {
        vi.clearAllMocks();
        selectCallIndex = 0;
        selectResults = [];
        insertReturningValue = { id: 'tx-123', createdAt: new Date() };

        // Default auth mock
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });

        // Default: successful balance check
        mockGetUsdcBalance.mockResolvedValue('500.0000000');

        // Default: successful payment
        mockSendPayment.mockResolvedValue({ hash: 'stellar-tx-hash-abc' });

        // Default: destination account has USDC trustline
        mockLoadAccount.mockResolvedValue({
            balances: [
                { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: MOCK_USDC_ISSUER, balance: '100.0' },
            ],
        });

        // Default: decrypt returns a valid secret
        mockDecryptWalletSecret.mockReturnValue(testKeypair.secret());

        // Reset update chain mock
        mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
        mockUpdateWhere.mockResolvedValue([]);
    });

    // ───────────────────────────── AUTH ─────────────────────────────

    it('should return 401 if unauthorized', async () => {
        vi.mocked(verify).mockRejectedValue(new Error('Invalid token'));

        const res = await app.request('/api/wallet/withdraw', {
            method: 'POST',
            headers: { Authorization: 'Bearer invalid.token' },
        });

        expect(res.status).toBe(401);
    });

    // ───────────────────────── BODY VALIDATION ──────────────────────

    it('should return 400 when destinationAddress is missing', async () => {
        const res = await makeRequest(app, { amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('destinationAddress is required');
    });

    it('should return 400 when amount is missing', async () => {
        const res = await makeRequest(app, { destinationAddress: validDestination });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('amount is required');
    });

    it('should return 400 for zero amount', async () => {
        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '0' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('amount must be a positive number');
    });

    it('should return 400 for negative amount', async () => {
        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '-5' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('amount must be a positive number');
    });

    it('should return 400 for amount with too many decimal places', async () => {
        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '1.12345678' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('amount must have at most 7 decimal places');
    });

    // ───────────────────────── NO WALLET ────────────────────────────

    it('should return 400 when user has no wallet provisioned', async () => {
        selectResults = [
            [{ walletAddress: null, walletSecretEnc: null }], // user record
        ];

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('No wallet provisioned for this account');
    });

    // ───────────────────────── COOLDOWN ─────────────────────────────

    it('should return 429 when withdrawal cooldown is active', async () => {
        const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }], // user record (step 2)
            [{ id: 'user-id' }], // for update lock
            [], // active Pending
            [{ createdAt: recentDate }], // recent withdrawal (step 4)
        ];

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toContain('cooldown');
        expect(body.retryAfter).toBeDefined();
    });

    // ──────────────── INVALID DESTINATION ADDRESS ──────────────────

    it('should return 400 for invalid destination Stellar address', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [], 
            []
        ];

        const res = await makeRequest(app, { destinationAddress: 'INVALID_ADDRESS', amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Invalid destination Stellar address');
    });

    // ──────────────── DESTINATION MISSING TRUSTLINE ─────────────────

    it('should return 400 when destination has no USDC trustline', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];

        mockLoadAccount.mockResolvedValue({
            balances: [{ asset_type: 'native', balance: '100.0' }],
        });

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Destination account does not have a USDC trustline');
    });

    // ──────────────── DESTINATION NOT FOUND ON NETWORK ──────────────

    it('should return 400 when destination account does not exist', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];

        mockLoadAccount.mockRejectedValue({ response: { status: 404 } });

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Destination account not found on Stellar network');
    });

    // ──────────────── INSUFFICIENT BALANCE ──────────────────────────

    it('should return 400 when balance is insufficient', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];

        mockGetUsdcBalance.mockResolvedValue('5.0000000');

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '100' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Insufficient USDC balance');
        expect(body.available).toBe('5.0000000');
        expect(body.requested).toBe('100');
    });

    // ──────────────── STELLAR PAYMENT FAILURE ───────────────────────

    it('should return 502 and mark transaction as pending_verification for ambiguous failure', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];

        mockSendPayment.mockRejectedValue(new Error('Network timeout'));

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toContain('Withdrawal submission timed out');
        expect(body.transactionId).toBe('tx-123');
        expect(body.status).toBe('pending_verification');

        // Verify DB update
        expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
            status: 'pending_verification'
        }));
    });

    it('should return 400 and mark transaction as failed when Stellar payment fails unambiguously', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];

        const err: any = new Error('Bad request');
        err.response = { status: 400 };
        mockSendPayment.mockRejectedValue(err);

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '10' });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Withdrawal failed');
        expect(body.transactionId).toBe('tx-123');

        // Verify DB update
        expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed'
        }));
    });

    // ──────────────── SUCCESSFUL WITHDRAWAL ─────────────────────────

    it('should process a successful withdrawal and return 200', async () => {
        selectResults = [
            [{ walletAddress: testKeypair.publicKey(), walletSecretEnc: 'enc-secret' }],
            [{ id: 'user-id' }],
            [],
            [],
        ];
        const txCreatedAt = new Date();
        insertReturningValue = { id: 'tx-456', createdAt: txCreatedAt };

        const res = await makeRequest(app, { destinationAddress: validDestination, amount: '50' });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.transactionId).toBe('tx-456');
        expect(body.data.status).toBe('completed');
        expect(body.data.stellarTxHash).toBe('stellar-tx-hash-abc');
        expect(body.data.amount).toBe('50');
        expect(body.data.destinationAddress).toBe(validDestination);

        // Should have decrypted the wallet secret
        expect(mockDecryptWalletSecret).toHaveBeenCalledWith('enc-secret');
        // Should have sent payment via Stellar
        expect(mockSendPayment).toHaveBeenCalled();
    });
});
