/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, type Mock } from 'vitest';

/**
 * Mock Gemini AI service interface.
 */
export interface MockGeminiService {
    generateContent: Mock<(...args: any[]) => any>;
    chatCompletion: Mock<(...args: any[]) => any>;
}

/**
 * Creates a mock Gemini AI service for use in tests.
 *
 * @example
 * ```ts
 * const gemini = createMockGeminiService();
 * gemini.generateContent.mockResolvedValue({ text: 'AI response' });
 * ```
 */
export function createMockGeminiService(): MockGeminiService {
    return {
        generateContent: vi.fn<(...args: any[]) => any>().mockResolvedValue({
            text: 'Mock AI response',
            finishReason: 'STOP',
        }),
        chatCompletion: vi.fn<(...args: any[]) => any>().mockResolvedValue({
            text: 'Mock chat response',
            finishReason: 'STOP',
        }),
    };
}

/**
 * Mock Stellar blockchain service interface.
 */
export interface MockStellarService {
    getBalance: Mock<(...args: any[]) => any>;
    sendPayment: Mock<(...args: any[]) => any>;
    createAccount: Mock<(...args: any[]) => any>;
}

/**
 * Creates a mock Stellar service for use in tests.
 *
 * @example
 * ```ts
 * const stellar = createMockStellarService();
 * stellar.getBalance.mockResolvedValue('100.00');
 * ```
 */
export function createMockStellarService(): MockStellarService {
    return {
        getBalance: vi.fn<(...args: any[]) => any>().mockResolvedValue('0.00'),
        sendPayment: vi.fn<(...args: any[]) => any>().mockResolvedValue({ hash: 'mock-tx-hash', success: true }),
        createAccount: vi.fn<(...args: any[]) => any>().mockResolvedValue({ publicKey: 'MOCK_PUBLIC_KEY' }),
    };
}

