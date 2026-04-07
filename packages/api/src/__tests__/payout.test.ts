import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { orchestratePayout } from '../services/payout';
import { db } from '../db';
import { StellarClient } from '../services/stellar';

vi.mock('@stellar/stellar-sdk', () => ({
    Keypair: {
        fromSecret: vi.fn()
    }
}));

// Setup basic environment variables for the test
process.env.PLATFORM_ESCROW_SECRET = 'SAK7X2B2DHYV3P4A2ZYGXVXJZXVXZXVXZXVXZXVXZXVXZXVXZXVXZX';
process.env.USDC_ASSET_ISSUER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
process.env.STELLAR_NETWORK = 'TESTNET';

// Mock DB
const mockSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(true)
});
const mockUpdate = vi.fn().mockReturnValue({
    set: mockSet
});

vi.mock('../db', () => ({
    db: {
        update: (...args: any[]) => mockUpdate(...args),
        query: {
            users: {
                findFirst: vi.fn()
            }
        }
    }
}));

// Mock StellarClient
const mockSendPayment = vi.fn();
const mockCall = vi.fn().mockResolvedValue({ records: [] });
const mockLimit = vi.fn().mockReturnValue({ call: mockCall });
const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
const mockForAccount = vi.fn().mockReturnValue({ order: mockOrder });

vi.mock('../services/stellar', () => {
    return {
        StellarClient: class {
            sendPayment = mockSendPayment;
            server = {
                transactions: () => ({
                    forAccount: mockForAccount
                })
            }
        }
    };
});

describe('orchestratePayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should execute payment successfully and update transaction status to completed', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'dev-1',
            walletAddress: 'GAJ7X2B2DHYV3P4A2ZYGXVXJZXVXZXVXZXVXZXVXZXVXZXVXZXVXZX'
        } as any);

        mockSendPayment.mockResolvedValue({ hash: 'stellar-hash-123' });

        await orchestratePayout('tx-1', 'dev-1', '50.00');

        expect(mockSendPayment).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith({
            status: 'completed',
            stellarTxHash: 'stellar-hash-123',
            updatedAt: expect.any(Date),
        });
    });

    it('should retry payment on transient failure and eventually succeed', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'dev-1',
            walletAddress: 'GAJ7X2B2DHYV3P4A2ZYGXVXJZXVXZXVXZXVXZXVXZXVXZXVXZXVXZX'
        } as any);

        // Fail once, then succeed
        mockSendPayment
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValueOnce({ hash: 'stellar-hash-456' });

        vi.useFakeTimers();

        const payoutPromise = orchestratePayout('tx-2', 'dev-1', '50.00');
        await vi.runAllTimersAsync();
        await payoutPromise;

        vi.useRealTimers();

        expect(mockSendPayment).toHaveBeenCalledTimes(2);
        expect(mockSet).toHaveBeenCalledWith({
            status: 'completed',
            stellarTxHash: 'stellar-hash-456',
            updatedAt: expect.any(Date),
        });
    });

    it('should permanently fail and update status to failed after max retries', async () => {
        vi.mocked(db.query.users.findFirst).mockResolvedValue({
            id: 'dev-1',
            walletAddress: 'GAJ7X2B2DHYV3P4A2ZYGXVXJZXVXZXVXZXVXZXVXZXVXZXVXZXVXZX'
        } as any);

        mockSendPayment.mockRejectedValue(new Error('Permanent Network Error'));

        vi.useFakeTimers();

        const payoutPromise = orchestratePayout('tx-3', 'dev-1', '50.00');
        await vi.runAllTimersAsync();
        await payoutPromise;

        vi.useRealTimers();

        expect(mockSendPayment).toHaveBeenCalledTimes(3);
        expect(mockSet).toHaveBeenCalledWith({
            status: 'failed',
            updatedAt: expect.any(Date),
        });
    });
});
