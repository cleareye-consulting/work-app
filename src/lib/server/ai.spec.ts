import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { generateClientSummary } from './ai';

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
			lastSummary: null,
			workItems: []
		});

		expect(result).toBe('Work remains in progress.');
		expect(generateContent).toHaveBeenCalledTimes(2);
		expect(generateContent).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				config: expect.objectContaining({ maxOutputTokens: 8192 })
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
