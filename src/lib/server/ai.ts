import {
	FinishReason,
	GoogleGenAI,
	HarmCategory,
	HarmBlockThreshold,
	type Content
} from '@google/genai';
import type { WorkItem, WorkItemChangeEvent } from '../../types';

export async function generateDocumentSummary(content: string) {
	const provider = process.env.AI_PROVIDER || 'gemini';

	switch (provider) {
		case 'anthropic':
			return anthropicSummary(content);
		case 'openai':
			return openaiSummary(content);
		case 'gemini':
			return geminiSummary(content);
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
			messages: [
				{
					role: 'user',
					content: `Summarize this document in 1-2 sentences:\n\n${content}`
				}
			]
		})
	});

	const data = await response.json();
	return data.content[0].text;
}

async function openaiSummary(content: string) {
	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
	const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
			model: 'gemini-3.5-flash',
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			config: {
				// Safety settings help manage the model's output
				safetySettings: [
					{
						category: HarmCategory.HARM_CATEGORY_HARASSMENT,
						threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
					}
				],
				// A lower temperature for less creative, more factual summarization
				temperature: 0.2,
				// Limit the maximum number of tokens for the summary output
				maxOutputTokens: 1024
			}
		});

		const responseText = (response.candidates?.[0]?.content?.parts ?? [])
			.filter((part) => typeof part.text === 'string' && !part.thought)
			.map((part) => part.text)
			.join('');
		if (!responseText) {
			console.error('No text found in the response.', response);
			return '';
		}
		return responseText.trim();
	} catch (error) {
		console.error('Error generating summary with Gemini:', error);
		throw new Error('Failed to generate AI summary.');
	}
}

export interface ClientSummaryWorkItemInput {
	workItem: WorkItem;
	events: WorkItemChangeEvent[];
	directHours: number;
	children: ClientSummaryWorkItemInput[];
}

export interface ClientSummaryInput {
	periodLabel: string;
	activityProjects: ClientSummaryWorkItemInput[];
	noActivityProjectNames: string[];
}

type AiProvider = 'anthropic' | 'openai' | 'gemini';

interface TextGenerationResult {
	text: string;
	stopReason: 'complete' | 'length' | 'blocked' | 'unknown';
}

const CLIENT_SUMMARY_MAX_OUTPUT_TOKENS = 16384;

function getAiProvider(): AiProvider {
	const provider = process.env.AI_PROVIDER || 'gemini';
	if (provider === 'anthropic' || provider === 'openai' || provider === 'gemini') {
		return provider;
	}
	throw new Error(`Unsupported AI provider: ${provider}`);
}

async function generateText(
	provider: AiProvider,
	prompt: string,
	maxOutputTokens: number
): Promise<TextGenerationResult> {
	switch (provider) {
		case 'anthropic':
			return generateAnthropicText(prompt, maxOutputTokens);
		case 'openai':
			return generateOpenAiText(prompt, maxOutputTokens);
		case 'gemini':
			return generateGeminiText(prompt, maxOutputTokens);
	}
}

async function generateAnthropicText(
	prompt: string,
	maxOutputTokens: number
): Promise<TextGenerationResult> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': process.env.ANTHROPIC_API_KEY!,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
			max_tokens: maxOutputTokens,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!response.ok) {
		throw new Error(`Anthropic request failed with status ${response.status}`);
	}

	const data = await response.json();
	const text = (data.content ?? [])
		.filter((part: { type?: string; text?: string }) => part.type === 'text')
		.map((part: { text: string }) => part.text)
		.join('');
	return {
		text,
		stopReason:
			data.stop_reason === 'max_tokens' ? 'length' : data.stop_reason ? 'complete' : 'unknown'
	};
}

async function generateOpenAiText(
	prompt: string,
	maxOutputTokens: number
): Promise<TextGenerationResult> {
	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: process.env.OPENAI_MODEL || 'gpt-4',
			max_tokens: maxOutputTokens,
			messages: [{ role: 'user', content: prompt }]
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI request failed with status ${response.status}`);
	}

	const data = await response.json();
	const choice = data.choices?.[0];
	return {
		text: choice?.message?.content ?? '',
		stopReason:
			choice?.finish_reason === 'length' ? 'length' : choice?.finish_reason ? 'complete' : 'unknown'
	};
}

async function generateGeminiText(
	prompt: string,
	maxOutputTokens: number
): Promise<TextGenerationResult> {
	const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
	const response = await ai.models.generateContent({
		model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
		contents: [{ role: 'user', parts: [{ text: prompt }] }],
		config: {
			temperature: 0.7,
			maxOutputTokens
		}
	});

	const candidate = response.candidates?.[0];
	const finishReason = candidate?.finishReason;
	const text = (candidate?.content?.parts ?? [])
		.filter((part) => typeof part.text === 'string' && !part.thought)
		.map((part) => part.text)
		.join('');

	return {
		text,
		stopReason:
			finishReason === 'MAX_TOKENS'
				? 'length'
				: finishReason === 'SAFETY' ||
					  finishReason === 'BLOCKLIST' ||
					  finishReason === 'PROHIBITED_CONTENT'
					? 'blocked'
					: finishReason
						? 'complete'
						: 'unknown'
	};
}

function renderWorkItemInput(input: ClientSummaryWorkItemInput, depth = 0): string {
	const { workItem, events } = input;
	const indent = '  '.repeat(depth);

	let out = `${indent}### ${workItem.type}: ${workItem.name}\n`;
	out += `${indent}Status: ${workItem.status}\n`;

	if (workItem.description) {
		out += `${indent}Description: ${workItem.description}\n`;
	}

	if (Object.keys(workItem.customFields).length) {
		out += `${indent}Custom Fields: ${JSON.stringify(workItem.customFields)}\n`;
	}

	if (events.length) {
		out += `${indent}Activity this period:\n`;
		for (const event of events) {
			out += `${indent}  - ${event.createdAt.toISOString()}: ${event.summaryOfChanges}\n`;
		}
	}

	if (input.directHours > 0) {
		out += `${indent}Time in period: ${input.directHours.toFixed(2)} hours\n`;
	}

	if (workItem.documents?.length) {
		out += `${indent}Notes:\n`;
		for (const doc of workItem.documents) {
			out += `${indent}  [${doc.name}]\n`;
			out += `${indent}  ${doc.content.replace(/\n/g, `\n${indent}  `)}\n`;
		}
	}

	if (input.children.length) {
		out += `${indent}Children:\n`;
		for (const child of input.children) {
			out += renderWorkItemInput(child, depth + 1);
		}
	}

	return out;
}

export async function generateClientSummary(input: ClientSummaryInput) {
	const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
	const activityProjectsText = input.activityProjects.length
		? input.activityProjects.map((project) => renderWorkItemInput(project)).join('\n---\n')
		: 'None.';
	const noActivityProjectsText = input.noActivityProjectNames.length
		? input.noActivityProjectNames.map((name) => `- ${name}`).join('\n')
		: 'None.';

	// Keep this instruction prefix static. The selected period and project data belong later in
	// the request, which is friendlier to Gemini's prefix-based implicit context caching.
	const prompt = `You write concise client updates from supplied project data.
Use only the supplied data. Organize the update by project. Describe completed work, current
work, blockers, and decisions only when directly supported by the data. Include time totals
only when they help explain effort. Include a brief \"No activity this period\" list from the
supplied projects. Do not restate unchanged background, infer progress, invent next steps,
describe a project as active merely because it exists, use an executive-summary section, or
use filler such as \"this period was marked by.\" Use direct, client-friendly Markdown.

## Project data with activity
${activityProjectsText}

## Projects with no activity this period
${noActivityProjectsText}

## Request
Write the client update for ${input.periodLabel}. If there was no activity, say so plainly.`;

	try {
		const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
		let generatedContent = '';

		for (let attempt = 0; attempt < 3; attempt++) {
			const response = await ai.models.generateContent({
				model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
				contents,
				config: {
					temperature: 0.7,
					maxOutputTokens: CLIENT_SUMMARY_MAX_OUTPUT_TOKENS
				}
			});

			const responseText = response.text ?? '';
			generatedContent += responseText;

			const candidate = response.candidates?.[0];
			if (candidate?.finishReason !== FinishReason.MAX_TOKENS) {
				return generatedContent.trim();
			}

			if (!responseText || !candidate.content) {
				throw new Error('Gemini reached its output limit without continuation content.');
			}

			contents.push(candidate.content, {
				role: 'user',
				parts: [{ text: 'Continue exactly where you stopped. Do not repeat any of the summary.' }]
			});
		}

		throw new Error('Gemini repeatedly reached its output limit.');
	} catch (error) {
		console.error('Error generating AI client summary:', error);
		throw new Error('Failed to generate AI client summary.');
	}
}
