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

export async function generateClientSummary(
	lastSummary: string | null,
	events: any[],
	documents: any[],
	workItems: any[]
) {
	const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

	const workItemMap = new Map(workItems.map((wi) => [wi.id, wi]));

	// Group events and documents by work item to preserve context
	const workItemContexts = workItems.map((wi) => {
		const wiEvents = events.filter((e) => e.workItemId === wi.id);
		const wiDocuments = documents.filter((d) => d.workItemId === wi.id);

		if (wiEvents.length === 0 && wiDocuments.length === 0) return null;

		const parentInfo = wi.parentId && wi.parentId !== 0 
			? ` (Parent: ${wi.parentName || 'Work Item #' + wi.parentId})` 
			: ' (Top-level Project)';

		let context = `### Work Item: ${wi.name} [Type: ${wi.type}]${parentInfo}\n`;
		context += `Status: ${wi.status}\n`;
		if (wi.description) context += `Description: ${wi.description}\n`;

		if (wiEvents.length > 0) {
			context += `Recent Changes:\n`;
			wiEvents.forEach((e) => {
				context += `- ${e.createdAt.toLocaleString()}: ${e.summaryOfChanges}\n`;
			});
		}

		if (wiDocuments.length > 0) {
			context += `Related Documents/Notes:\n`;
			wiDocuments.forEach((d) => {
				context += `- ${d.name} (${d.type}): ${d.summary || d.content.substring(0, 1000)}\n`;
			});
		}

		return context;
	}).filter(Boolean);

	const contextText = workItemContexts.join('\n---\n');

	const prompt = `
        You are a professional assistant drafting a weekly client summary.
        
        PREVIOUS SUMMARY:
        ${lastSummary || 'No previous summary available.'}
        
        RECENT ACTIVITY (Organized by Work Item):
        ${contextText || 'No recent activity recorded.'}
        
        Based on the previous summary and the recent activity (events and documents) organized by work item, draft a new client summary.
        
        GUIDELINES:
        - The audience is technical enough to understand details but interested in business outcomes.
        - Goal: Communicate progress on business objectives and technical milestones.
        - Group the summary by project or major feature. Do NOT blend all work together into a single chronological narrative.
        - Use the work item names and types to provide context.
        - Pay close attention to the parent/child relationships. A child item's progress should be discussed in the context of its parent project/feature when appropriate.
        - Note any blockers explicitly.
        - This is a RETROSPECTIVE summary. Do not speculate on future work.
        - Tone: Reference the provided documents/notes for tone, but prefer simple and clear communication over "punchy" or overly corporate language.
        - Output Format: Markdown. Use headers to separate distinct projects or focus areas.
    `;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-3-flash-preview',
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