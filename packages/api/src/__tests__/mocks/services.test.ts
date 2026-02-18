import { describe, it, expect } from 'vitest';
import { createMockGeminiService, createMockStellarService } from './services';

describe('Service Mock Utilities', () => {
    describe('Gemini Service Mock', () => {
        it('should create a functional mock Gemini service', async () => {
            const gemini = createMockGeminiService();
            const result = await gemini.generateContent('test prompt');

            expect(result.text).toBe('Mock AI response');
            expect(gemini.generateContent).toHaveBeenCalledWith('test prompt');
        });

        it('should allow overriding responses', async () => {
            const gemini = createMockGeminiService();
            gemini.generateContent.mockResolvedValue({ text: 'Custom response', finishReason: 'STOP' });

            const result = await gemini.generateContent('any');
            expect(result.text).toBe('Custom response');
        });
    });

    describe('Stellar Service Mock', () => {
        it('should create a functional mock Stellar service', async () => {
            const stellar = createMockStellarService();
            const balance = await stellar.getBalance('MOCK_ADDRESS');

            expect(balance).toBe('0.00');
            expect(stellar.getBalance).toHaveBeenCalledWith('MOCK_ADDRESS');
        });

        it('should mock payments', async () => {
            const stellar = createMockStellarService();
            const result = await stellar.sendPayment('to', '10.0');

            expect(result.success).toBe(true);
            expect(result.hash).toBeDefined();
        });
    });
});
