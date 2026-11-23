import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({
	generateContent: vi.fn()
}));

vi.mock('@google/genai', () => ({
	FinishReason: {
		MAX_TOKENS: 'MAX_TOKENS'
	},
	GoogleGenAI: class {
		models = { generateContent };
	},
	HarmCategory: {
		HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT'
	},
	HarmBlockThreshold: {
		BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE'
	}
}));

import { generateClientSummary, generateDocumentSummary } from './ai';

describe('generateClientSummary', () => {
	beforeEach(() => {
		generateContent.mockReset();
	});

	it('continues a response that reaches the output token limit', async () => {
		const firstContent = {
			role: 'model',
			parts: [{ text: 'Work remains in prog' }]
		};
		generateContent
			.mockResolvedValueOnce({
				text: 'Work remains in prog',
				candidates: [{ finishReason: 'MAX_TOKENS', content: firstContent }]
			})
			.mockResolvedValueOnce({
				text: 'ress.',
				candidates: [{ finishReason: 'STOP' }]
			});

		const result = await generateClientSummary({
			periodLabel: 'this week so far',
			activityProjects: [],
			noActivityProjectNames: []
		});

		expect(result).toBe('Work remains in progress.');
		expect(generateContent).toHaveBeenCalledTimes(2);
		expect(generateContent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				config: expect.objectContaining({ maxOutputTokens: 16384 })
			})
		);
		expect(generateContent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				contents: expect.arrayContaining([firstContent])
			})
		);
	});
});

describe('generateDocumentSummary', () => {
	beforeEach(() => {
		generateContent.mockReset();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-02T18:42:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('uses a timestamped fallback when Gemini cannot generate a summary', async () => {
		generateContent.mockRejectedValueOnce(new Error('prepayment credits are depleted'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(generateDocumentSummary('Important project note')).resolves.toBe(
			'Note added 2026-11-02 18:42 UTC'
		);

		expect(errorSpy).toHaveBeenCalledWith('Error generating document summary:', expect.any(Error));
		errorSpy.mockRestore();
	});

	it('uses a timestamped fallback when Gemini returns no text', async () => {
		generateContent.mockResolvedValueOnce({ candidates: [] });
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(generateDocumentSummary('Important project note')).resolves.toBe(
			'Note added 2026-11-02 18:42 UTC'
		);

		errorSpy.mockRestore();
	});
});
