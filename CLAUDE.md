# Vilgain MCP Server

MCP server for shopping on Vilgain.cz (healthy food e-shop, formerly Aktin). TypeScript, stdio transport.

## Architecture

Three layers, keep them separate:

- `src/vilgain-api.ts` – HTTP client for the reverse engineered website endpoints. Session/cookie handling, login, one method per shop action. Endpoint map: `docs/api.md`.
- `src/parsers/` – pure functions `(html) => data`. All HTML/dataLayer parsing lives here, nothing else does network I/O or parsing.
- `src/tools/` – MCP tool definitions, thin wrappers over the API client. One factory function per tool (returns `{name, definition, handler}`), registered in `src/index.ts`.

## Commands

- `npm run build` – compile to `dist/`
- `npm test` – parser unit tests (offline, fixtures in `tests/fixtures/`)
- `npm run validate-api` – live smoke test against vilgain.cz; needs `.env` (copy `.env.example`). Run this after changing `vilgain-api.ts` or parsers — the site can change under us.
- `npm run inspect` – MCP Inspector for manual testing

## Conventions

- Everything in English (code, comments, docs). User-facing tool output is English; product data stays in the shop's language.
- Fixtures are sanitized real pages (no account emails/ids). When regenerating them, sanitize again and strip base64 data URIs.
- Vilgain is a Nette app: actions are `_do=...` signals POSTed as multipart forms, AJAX calls need `X-Requested-With: XMLHttpRequest` (see `docs/api.md` before touching the API client).
- Never automate checkout — cart management only.
