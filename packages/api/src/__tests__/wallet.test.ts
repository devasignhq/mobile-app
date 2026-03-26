/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';

// Hoist mock functions so they're available at vi.mock factory evaluation time
const { mockCreateAccount, mockSetupTrustline, mockLoadAccount, mockDecryptWalletSecret } = vi.hoisted(() => ({
    mockCreateAccount: vi.fn(),
    mockSetupTrustline: vi.fn(),
    mockLoadAccount: vi.fn(),
    mockDecryptWalletSecret: vi.fn(),
}));

// Mock dependencies before importing the module under test
vi.mock('../db', () => ({
    db: {
        update: vi.fn(function () {
            return {
                set: vi.fn(function () {
                    return { where: vi.fn() };
                }),
            };
        }),
        query: {
            users: {
                findFirst: vi.fn(),
            },
        },
    },
}));

vi.mock('../utils/encryption', () => ({
    encryptWalletSecret: vi.fn(() => 'encrypted-secret-payload'),
    decryptWalletSecret: mockDecryptWalletSecret,
}));

// Use a regular function (not arrow) so it can be called with `new`
vi.mock('../services/stellar', () => ({
    StellarClient: vi.fn(function () {
        return {
            createAccount: mockCreateAccount,
            setupTrustline: mockSetupTrustline,
            server: {
                loadAccount: mockLoadAccount,
            },
        };
    }),
}));

import { provisionWallet } from '../services/wallet';
import { db } from '../db';
import { encryptWalletSecret } from '../utils/encryption';
import { StellarClient } from '../services/stellar';

// Generate a real valid keypair for escrow mock
const escrowKeypair = Keypair.random();

describe('provisionWallet', () => {
    const mockUserId = 'user-uuid-123';
    const MOCK_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    beforeEach(() => {
        vi.clearAllMocks();
        // Restore the StellarClient constructor mock (vi.clearAllMocks strips mockImplementation)
        (StellarClient as any).mockImplementation(function () {
            return {
                createAccount: mockCreateAccount,
                setupTrustline: mockSetupTrustline,
                server: {
                    loadAccount: mockLoadAccount,
                },
            };
        });
        mockCreateAccount.mockResolvedValue({ hash: 'mock-create-tx' });
        mockSetupTrustline.mockResolvedValue({ hash: 'mock-trustline-tx' });
        // Default to account NOT found on network (404)
        mockLoadAccount.mockRejectedValue({ response: { status: 404 } });
        
        // Default to user found but NO wallet
        (db.query.users.findFirst as any).mockResolvedValue({ id: mockUserId });
        
        // Default decrypt to a random valid secret
        mockDecryptWalletSecret.mockReturnValue(Keypair.random().secret());

        process.env.PLATFORM_ESCROW_SECRET = escrowKeypair.secret();
        process.env.USDC_ASSET_ISSUER = MOCK_USDC_ISSUER;
        process.env.STELLAR_NETWORK = 'TESTNET';
        process.env.WALLET_ENCRYPTION_KEY = 'a'.repeat(64);
    });

    it('should successfully provision a wallet for a new user', async () => {
        const publicKey = await provisionWallet(mockUserId);

        // Should return a valid Stellar public key
        expect(publicKey).toBeDefined();
        expect(publicKey).toMatch(/^G[A-Z2-7]{55}$/);

        // Should have fetched the user
        expect(db.query.users.findFirst).toHaveBeenCalled();

        // Should have created a StellarClient
        expect(StellarClient).toHaveBeenCalledWith('TESTNET');

        // Should have called createAccount since loadAccount failed with 404
        expect(mockCreateAccount).toHaveBeenCalledTimes(1);
        const createAccountArgs = mockCreateAccount.mock.calls[0];
        expect(createAccountArgs[0]).toBeInstanceOf(Keypair);
        expect(createAccountArgs[1]).toBeInstanceOf(Keypair);
        expect(createAccountArgs[2]).toBe('3');

        // Should have set up USDC trustline
        expect(mockSetupTrustline).toHaveBeenCalledTimes(1);

        // Should have encrypted and stored in DB
        expect(encryptWalletSecret).toHaveBeenCalledTimes(1);
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('should reuse existing keys if user already has a wallet', async () => {
        const testKeypair = Keypair.random();
        const existingWalletAddress = testKeypair.publicKey();
        const existingSecret = testKeypair.secret();
        
        (db.query.users.findFirst as any).mockResolvedValue({
            id: mockUserId,
            walletAddress: existingWalletAddress,
            walletSecretEnc: 'already-encrypted-payload'
        });
        mockDecryptWalletSecret.mockReturnValue(existingSecret);

        const publicKey = await provisionWallet(mockUserId);

        expect(publicKey).toBe(existingWalletAddress);
        
        // Should NOT have updated DB since keys already exist
        expect(db.update).not.toHaveBeenCalled();
        
        // Should STILL have checked the network and called createAccount (if 404)
        expect(mockLoadAccount).toHaveBeenCalled();
        expect(mockCreateAccount).toHaveBeenCalled();
    });

    it('should skip creation but still set up trustline if account exists without one', async () => {
        mockLoadAccount.mockResolvedValue({
            id: 'some-account',
            balances: [{ asset_type: 'native', balance: '3.0' }],
        });

        await provisionWallet(mockUserId);

        // Should NOT have called createAccount
        expect(mockCreateAccount).not.toHaveBeenCalled();
        
        // SHOULD set up trustline since USDC trustline doesn't exist
        expect(mockSetupTrustline).toHaveBeenCalled();
    });

    it('should skip both creation and trustline if account is fully provisioned', async () => {
        mockLoadAccount.mockResolvedValue({
            id: 'some-account',
            balances: [
                { asset_type: 'native', balance: '3.0' },
                { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: MOCK_USDC_ISSUER, balance: '0.0' },
            ],
        });

        await provisionWallet(mockUserId);

        // Should NOT have called createAccount
        expect(mockCreateAccount).not.toHaveBeenCalled();

        // Should NOT have called setupTrustline — already exists
        expect(mockSetupTrustline).not.toHaveBeenCalled();
    });

    it('should throw if PLATFORM_ESCROW_SECRET is not set', async () => {
        delete process.env.PLATFORM_ESCROW_SECRET;

        await expect(provisionWallet(mockUserId)).rejects.toThrow(
            'PLATFORM_ESCROW_SECRET environment variable is not set'
        );
    });

    it('should throw if createAccount fails', async () => {
        mockCreateAccount.mockRejectedValue(new Error('Network error'));

        await expect(provisionWallet(mockUserId)).rejects.toThrow('Network error');

        // DB SHOULD have been updated (keys persist before funding)
        expect(db.update).toHaveBeenCalledTimes(1);
    });

    it('should throw if setupTrustline fails', async () => {
        mockSetupTrustline.mockRejectedValue(new Error('Trustline error'));

        await expect(provisionWallet(mockUserId)).rejects.toThrow('Trustline error');

        // DB SHOULD have been updated
        expect(db.update).toHaveBeenCalledTimes(1);
    });
});
