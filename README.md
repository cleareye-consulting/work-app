# ClearEye work app

This is a work tracking application designed around small-scale software development.

## Key features

- Client management: create and manage clients, contacts, and client metadata.
- Work item tracking: hierarchical work items/projects with statuses and parent/child relationships.
- Documents & notes: upload and attach documents to clients/work items.
- AI-powered summaries: generate document and client summaries using Gemini, OpenAI, or Anthropic.
- Events & activity feed: record events/changes and view recent activity per work item.
- Authentication: Google SSO (restrict access by email) via `@auth/sveltekit`.
- Storage: DynamoDB-backed persistence (AWS SDK v3).
- Tests & automation: Vitest unit tests and Playwright end-to-end tests; scripts for lint/format.

## Environment variables (overview)

The project reads several environment variables for authentication, AWS/DynamoDB access, and AI integrations. Do not commit real secrets — use your environment or a secrets manager. See `.env.example` for placeholders.

- `AUTH_GOOGLE_ID` — Google OAuth client ID for SSO
- `AUTH_GOOGLE_SECRET` — Google OAuth client secret
- `AWS_PROFILE` — (optional) AWS CLI profile name to use for credentials
- `AWS_ACCESS_KEY_ID` — AWS access key (used if `AWS_PROFILE` is not provided)
- `AWS_SECRET_ACCESS_KEY` — AWS secret key (used if `AWS_PROFILE` is not provided)
- `AWS_REGION` — AWS region for DynamoDB (e.g. `us-east-1`)
- `AI_PROVIDER` — Which AI provider to use: `gemini`, `openai`, or `anthropic` (default: `gemini`)
- `OPENAI_API_KEY` — OpenAI API key (if using `openai`)
- `ANTHROPIC_API_KEY` — Anthropic API key (if using `anthropic`)
- `GEMINI_API_KEY` — Google Gemini / GenAI API key (if using `gemini`)

## Testing

- Unit tests: `pnpm test:unit` (Vitest)
- End-to-end: `pnpm test:e2e` (Playwright)

## Notes for contributors

- Code style: Prettier + Tailwind + ESLint. Run `pnpm format` and `pnpm lint` before opening PRs.
- Keep components small and focused; follow existing patterns in `src/components/`.

## Project structure (high level)

- `src/routes/` — SvelteKit routes and pages
- `src/components/` — UI components used across pages
- `src/lib/server/` — server-side helpers (DB, AI, repositories)
- `static/` — static assets

## Deployment

- This project uses SvelteKit with the default adapter. Choose and configure an adapter for your target environment (Vercel, Netlify, AWS, etc.).
