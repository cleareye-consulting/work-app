import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { GEMINI_API_KEY } from '$env/static/private';

export async function generateDocumentSummary(content: string) {
	const provider = process.env.AI_PROVIDER || 'gemini';

	switch(provider) {
		case 'anthropic': return anthropicSummary(content);
		case 'openai': return openaiSummary(content);
		case 'gemini': return geminiSummary(content);
	}
}

async function anthropicSummary(content: string) {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': process.env.ANTHROPIC_API_KEY!,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-5-20250929',
			max_tokens: 150,
			messages: [{
				role: 'user',
				content: `Summarize this document in 1-2 sentences:\n\n${content}`
			}]
		})
	});

	const data = await response.json();
	return data.content[0].text;
}

async function openaiSummary(content: string) {
	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'gpt-4',
			messages: [{ role: 'user', content: `Summarize: ${content}` }]
		})
	});
	return (await response.json()).choices[0].message.content;
}

async function geminiSummary(content: string) {
	const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
	const prompt = `
						You are a file and code content labeler.
						Your only job is to generate a concise, user-friendly, and general-purpose label or title 
						that describes the provided content.
						Your response must be short and informative, using sentence fragments where appropriate, 
						and should never exceed one complete sentence.
						Do not include concluding punctuation, or any unnecessary characters.
						
						If there's a line at the top that looks like it might be a summary,
						especially if it's enclosed in triple asterisks,
						that's probably a good summary.
						
            DOCUMENT CONTENT:
            ---
            ${content}
            ---
        `;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			config: {
				// Safety settings help manage the model's output
				safetySettings: [
					{
						category: HarmCategory.HARM_CATEGORY_HARASSMENT,
						threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
					},
				],
				// A lower temperature for less creative, more factual summarization
				temperature: 0.2,
				// Limit the maximum number of tokens for the summary output
				maxOutputTokens: 1024,
			},
		});

		if (!response.text) {
			console.error('No text found in the response.', response);
			return ''
		}
		return response.text.trim();

	} catch (error) {
		console.error('Error generating summary with Gemini:', error);
		throw new Error('Failed to generate AI summary.');
	}
}