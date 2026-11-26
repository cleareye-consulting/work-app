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

## Local MCP access for coding agents

The app serves an MCP endpoint at `http://127.0.0.1:5173/mcp`. Its
`get_work_item_context` tool accepts a work item ID and returns the item, its
ancestor chain, all descendant work items, and documents, change events, and
time entries for those items, including custom fields such as a FEATURE's
`roadmap`. `add_work_item` creates a `STORY`, `NFR`, or `BUG` beneath an existing
parent. Stories are limited to FEATURE parents; NFRs and bugs follow the shared
type-to-parent mapping. It derives the client from the parent, starts the item
in `NEW`, and returns its ID. Use `update_work_item` to set custom fields after
creation. `update_work_item` accepts a work item ID and any combination of
`status`, `type`, `clientId`, `parentId` (set to `null` for a top-level item), and
`customFields` (for example, `{ "roadmap": "## Next quarter" }`). Omitted fields
are preserved; set a custom field to `null` to clear it. Name and description
cannot be edited through MCP. Type, status, custom field, and hierarchy values
are validated before saving. Moving an item to another client moves its descendants
and time entries with it. `add_work_item_note` adds a Markdown document
to an existing work item from a title and content, generates its summary, and
records a change event. The endpoint requires a bearer token; the browser
continues to use Google sign-in.

When you are ready to enable it, generate a token with `openssl rand -hex 32`.
Put that value in this app's ignored `.env` file as `WORK_APP_MCP_TOKEN=...`,
then set `WORK_APP_MCP_TOKEN` to the same value in the environment that launches
Codex or Claude Code. The endpoint is unavailable until a token of at least 32
characters is configured. Keep the token out of client repositories and checked-in
agent configuration. Restart or recreate the app after changing `.env`.

For Codex, add this to your local `~/.codex/config.toml`:

```toml
[mcp_servers.work_app]
url = "http://127.0.0.1:5173/mcp"
bearer_token_env_var = "WORK_APP_MCP_TOKEN"
```

For Claude Code, add a user-scoped server with a literal environment-variable
reference (the single quotes prevent your shell from expanding it now):

```sh
claude mcp add-json work-app '{"type":"http","url":"http://127.0.0.1:5173/mcp","headers":{"Authorization":"Bearer ${WORK_APP_MCP_TOKEN}"}}' --scope user
```

`codex mcp list` and `claude mcp list` show whether each client connected.
The Docker Compose configuration publishes the app and database ports only on
the host's loopback interface.

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
