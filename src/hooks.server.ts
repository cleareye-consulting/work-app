import { handle as authHandle } from './auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const authorization: Handle = async ({ event, resolve }) => {
	// The MCP endpoint validates its own bearer token.
	if (!event.url.pathname.startsWith('/auth') && event.url.pathname !== '/mcp') {
		const session = await event.locals.auth();
		if (!session) {
			// Redirect to the standard sign-in page
			throw redirect(303, '/auth/signin');
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(authHandle, authorization);
