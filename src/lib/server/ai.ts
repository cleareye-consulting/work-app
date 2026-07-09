import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import type { WorkItem, WorkItemChangeEvent, WorkItemDocument } from '../../types';

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
						threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
					},
				],
				// A lower temperature for less creative, more factual summarization
				temperature: 0.2,
				// Limit the maximum number of tokens for the summary output
				maxOutputTokens: 1024,
			},
		});

		const responseText = response.text;
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
	parent: ClientSummaryWorkItemInput | null;
}

export interface ClientSummaryInput {
	lastSummary: string | null;
	workItems: ClientSummaryWorkItemInput[];
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
		out += `${indent}Changes this period:\n`;
		for (const event of events) {
			out += `${indent}  - ${event.summaryOfChanges}\n`;
		}
	}

	if (workItem.documents?.length) {
		out += `${indent}Notes:\n`;
		for (const doc of workItem.documents) {
			out += `${indent}  [${doc.name}]\n`;
			out += `${indent}  ${doc.content.replace(/\n/g, `\n${indent}  `)}\n`;
		}
	}

	if (input.parent) {
		out += `${indent}Parent context:\n`;
		out += renderWorkItemInput(input.parent, depth + 1);
	}

	return out;
}

export async function generateClientSummary(input: ClientSummaryInput) {
	const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

	const workItemsText = input.workItems.map((wi) => renderWorkItemInput(wi)).join('\n---\n');

	const prompt = `You are preparing a weekly progress summary for a client.
${input.lastSummary ? `## Previous Summary\n${input.lastSummary}\n` : '## Previous Summary\nThis is the first summary for this client.\n'}
## Work Items With Activity This Period
${workItemsText}

## Instructions
Write an updated client-facing summary that:
- Reflects the current state of all active work
- Highlights what changed or progressed this period
- Notes any blockers, pending items, or open questions from the notes
- Incorporates relevant context from parent items
- Is written in plain, direct language — professional but conversational, as if giving a colleague a straightforward update. Avoid business jargon and filler phrases. Focus on what was done, what it means, and what's next.
`;


	try {
		const response = await ai.models.generateContent({
			model: 'gemini-3.5-flash',
			contents: [{ role: 'user', parts: [{ text: prompt }] }],
			config: {
				temperature: 0.7,
				maxOutputTokens: 2048
			}
		});

		const responseText = response.text;
		return responseText ? responseText.trim() : '';
	} catch (error) {
		console.error('Error generating client summary with Gemini:', error);
		throw new Error('Failed to generate AI client summary.');
	}
}