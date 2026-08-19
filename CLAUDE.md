# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

An MCP (Model Context Protocol) server that connects AI assistants to the [Targetprocess](https://www.targetprocess.com/) project management platform. It exposes tools that let Claude query and manage Targetprocess entities (user stories, bugs, features, releases, test plans) via the Targetprocess REST API.

## Commands

```bash
npm run build     # Compile TypeScript → build/ (runs rimraf first, chmod +x after)
npm start         # Build + run the server
npm test          # Run the vitest suite (tests/*.test.ts)
```

## Architecture

- **`src/index.ts`** — MCP server entry point. Creates `McpServer`, instantiates `TpClient`, registers all tools with Zod input schemas, and connects via `StdioServerTransport`. Each `server.registerTool()` call wires a Zod schema to a handler function from `src/handlers/`.
- **`src/handlers/*.ts`** — one file per tool (e.g. `create_bug.ts`, `update_bug.ts`, `get_bug_content.ts`), each exporting a `handle*` function that takes the `TpClient` plus the tool's params and returns MCP `content`. This is the layer with test coverage under `tests/`.
- **`src/tp.ts`** — `TpClient` class. Wraps the Targetprocess REST API with typed GET/POST/DELETE methods. Auth token is appended as a query param on every request. `get`/`post` return the parsed response, or an `Error` instance on failure (callers check `response instanceof Error`, not falsiness — an `Error` object is truthy). `postRaw`/`del` return a `TpResult<T>` (`{ ok: true, data }` or `{ ok: false, status, body }`) for call sites that need to surface TP's raw HTTP error detail.
- **`src/types.ts`** — TypeScript interfaces for Targetprocess API response shapes (UserStory, Bug, Release, Feature, TestPlan, General, etc.).
- **`src/config.ts`** — Loads env vars via dotenv: `TP_BASE_URL`, `TP_TOKEN`, `TP_OWNER_ID`, `TP_PROJECT_ID`, `TP_TEAM_ID`.

**Data flow**: MCP client (Claude) → stdio → `index.ts` tool registration → `src/handlers/*.ts` handler → `TpClient` method → Targetprocess HTTP API → response mapped to MCP content.

## Upstream

`origin` is a fork of `upstream` (SerhiiMaksymiv/targetprocess-mcp-server). Periodically check `upstream/main` for new commits and merge them in — recurring conflict hotspots are `src/index.ts` and `src/tp.ts`, since both repos frequently touch the same tool registrations.

HTML descriptions from Targetprocess are stripped to plain text using JSDOM before returning to the caller.

## Environment Variables

Copy `.env.example` and fill in:

| Variable | Purpose |
|----------|---------|
| `TP_TOKEN` | Targetprocess API token |
| `TP_BASE_URL` | Targetprocess API base URL |
| `TP_OWNER_ID` | Default owner/user ID |
| `TP_PROJECT_ID` | Target project ID |
| `TP_TEAM_ID` | Team ID |

## Adding New Tools

1. Add a method to `TpClient` in `src/tp.ts` for the API call
2. Add any new response types to `src/types.ts`
3. Add a `src/handlers/<tool_name>.ts` exporting a `handle*` function that calls the `TpClient` method and returns MCP content
4. Register the tool in `src/index.ts` using `server.registerTool()` with a Zod `inputSchema`, wired to the handler
5. Add a `tests/<tool_name>.test.ts` (or extend an existing suite) covering success and failure paths

## Known Quirks

- Some project/team IDs are hardcoded in `tp.ts` in addition to being read from env
