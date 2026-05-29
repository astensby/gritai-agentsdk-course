# GritAI · Claude Agent SDK Workshop

A hands-on, progressive workshop for the [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview) in TypeScript, by [GritAI](https://gritai.no). Fourteen runnable step folders, one root install, one `.env` file. Drop in at any step.

> **Interactive companion:** open [`guide.html`](./guide.html) in a browser for a visual walk-through of the whole arc, with expandable step cards and copyable run commands.

## What you'll build

You start with a **single API call** and finish with a **useful agent** that turns raw meeting transcripts into structured summaries — composing MCP servers, Skills, hooks, and built-in tools along the way.

| Step | What it adds | Key SDK concept |
|---|---|---|
| [`step-0-raw-api`](./step-0-raw-api) | The Anthropic SDK with no Agent SDK | `messages.create()` — the primitive everything else wraps |
| [`step-1-hello-loop`](./step-1-hello-loop) | A single `query()` call | Async-iterable message stream |
| [`step-2-external-mcp`](./step-2-external-mcp) | An external MCP server (filesystem) | `mcpServers` + `allowedTools` |
| [`step-2b-builtin-tools`](./step-2b-builtin-tools) | The SDK's built-in `Read`/`Write`/`Bash`/... | MCP isn't needed for everything |
| [`step-3-custom-mcp`](./step-3-custom-mcp) | Your own TS functions as MCP tools (canned data) | `createSdkMcpServer` + `tool()` + zod |
| [`step-3b-real-weather`](./step-3b-real-weather) | The same tool, now calling a real API | `fetch` → Open-Meteo (no key) |
| [`step-4-skills`](./step-4-skills) | A Skill the agent invokes autonomously | `.claude/skills/` + `settingSources` |
| [`step-5-interactive-repl`](./step-5-interactive-repl) | Multi-turn terminal chat | Session continuity via `resume` |
| [`step-6-web-chat`](./step-6-web-chat) | The same agent behind a Next.js UI | Token streaming via `includePartialMessages` |
| [`step-7-subagents`](./step-7-subagents) | Delegate to specialist subagents | `agents` option + `Task` tool |
| [`step-8-hooks`](./step-8-hooks) | Observe / audit / block tool calls | `PreToolUse` hooks |
| [`step-9-permissions`](./step-9-permissions) | Interactive "allow this?" prompts | `canUseTool` callback + `permissionMode` |
| [`step-10-capstone-meeting-notes`](./step-10-capstone-meeting-notes) | **Capstone** — meeting-notes agent | Composes built-ins + skill + hook into one useful agent |
| [`step-11-vercel-ai-ollama`](./step-11-vercel-ai-ollama) | Same patterns, **different SDK + local model** | Vercel AI SDK v6 + Ollama + manual skill loader |

## Setup (once)

```bash
git clone <this repo>
cd gritai-agentsdk-course
cp .env.example .env       # paste your ANTHROPIC_API_KEY
npm install                # installs deps for all 14 steps (workspaces)
```

That's it. No per-folder `cd`, no per-folder `npm install`, no per-folder `.env`.

## Run any step

```bash
npm run step-1             # smallest possible agent
npm run step-3             # custom MCP server with weather tool
npm run step-6             # spins up the Next.js web chat at localhost:3000
npm run step-7             # subagents (code reviewer + test planner)
npm run step-10            # the capstone meeting-notes agent
```

All scripts are listed in the root `package.json`. One has a variant:

```bash
npm run step-5-streaming   # step 5's advanced streaming-input variant
```

## Prerequisites

- **Node.js 20+** (`nvm use` picks up `.nvmrc`)
- **An Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com/)
- **npm** (ships with Node)
- *(For step 11)* — a running [Ollama](https://ollama.ai) server with a tool-capable model pulled

> **No separate Claude Code CLI install needed.** The Agent SDK is a [standalone package](https://docs.claude.com/en/api/agent-sdk/overview); the TypeScript SDK bundles a native Claude Code binary as an optional dependency, so `npm install` is all you need.

## How the env works

`tsx --env-file=../.env src/index.ts` — that's what every step's `start` script does. Node's built-in `--env-file` flag loads the root `.env` into `process.env` before your code runs. No `dotenv` package, no per-step `.env` files, no `import "dotenv/config"` line — one source of truth.

Next.js (step 6) uses `dotenv-cli` to do the same thing, since `next dev` has its own env-loading conventions.

## Workshop plan

A suggested order through the steps, grouped by what each phase builds. Skip around if you're self-paced — every step is standalone — but the phases land cleanly back-to-back in a live workshop.

- **Phase 1 — Build the loop.** The agent loop and its tools, from the raw API to a tool that calls the real world: `step-0` → `step-1` → `step-2` + `step-2b` (external MCP vs built-ins) → `step-3` → `step-3b` (same tool, real API).
- **Phase 2 — Teach it well.** Skills change behaviour without changing code; subagents split a big job into specialists: `step-4` → `step-7`.
- **Phase 3 — Put it to work.** Real I/O, observability, permissions, and composition: `step-5` → `step-6` (web) → `step-8` (hooks) → `step-9` (permissions) → `step-10` (**capstone**) → `step-11` (alt SDK + local model, bonus).

## Common gotchas

1. **`ANTHROPIC_API_KEY` not set** — make sure you copied `.env.example` to `.env` (at the **root**, not inside a step folder) and pasted your key.
2. **A Skill isn't loading** — skills are discovered from your setting sources. The SDK default loads all of them (`user` + `project` + `local`), so a project's `.claude/skills/` is picked up automatically. If you've passed `settingSources: []` (isolation mode) you've turned discovery off — include `"project"`. See [step-4](./step-4-skills).
3. **An MCP tool doesn't fire** — list it (or a wildcard) in `allowedTools`. Tools are named `mcp__<server-name>__<tool-name>`. Built-in tools use bare names (`Read`, `Write`, ...).
4. **Node too old** — the SDK requires Node 18+; the workspace `tsx --env-file` flag requires Node 20.6+. This repo uses 20.

## "Can I just run one step in isolation?"

Yes. Each step folder is still a complete project. After the root `npm install`, you can also do:

```bash
cd step-3-custom-mcp
npm start
```

That'll work because npm workspaces hoist the deps into the root `node_modules`. If you want to copy a step folder out of this repo and use it as a standalone project, run `npm install` inside it — its `package.json` declares all its deps.

## Supply-chain notes

- The root `package.json` pins `overrides: { postcss: "^8.5.10" }`, which forces a patched postcss into Next.js's build pipeline (step 6) and resolves [GHSA-qx2v-qp2m-jg93]. With that override in place, `npm install` should report **`0 vulnerabilities`** (verify on a clean clone). Do **not** run `npm audit fix --force` — it would downgrade Next.js to 9.x and pull in dozens of advisories; the override is the correct fix.

## Further reading

- [Agent SDK Overview](https://docs.claude.com/en/api/agent-sdk/overview)
- [TypeScript SDK Reference](https://docs.claude.com/en/api/agent-sdk/typescript)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Skills documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- For **MCP Apps / UI resources**, see our separate MCP course material — the rendering story is host-side, not SDK-side, so it lives there.


# Quickstart
┌──────────────────────────┬──────────────────────────────────────────────────────┐
│         Command          │                     What it runs                     │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-0           │ Raw Anthropic SDK (no Agent SDK)                     │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-1           │ Minimum viable Agent SDK loop                        │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-2           │ External MCP (filesystem)                            │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-2b          │ Built-in tools, no MCP                               │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-3           │ Custom MCP (weather tool)                            │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-4           │ Skills                                               │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-5           │ Interactive REPL (resume pattern)                    │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-5-streaming │ REPL via streaming-input mode                        │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-6           │ Next.js web chat (opens at localhost:3000)           │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-7           │ Subagents                                            │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-8           │ Hooks (logging + Bash-deny)                          │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-9           │ Interactive permissions                              │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-10          │ Capstone — meeting-notes agent                       │
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run step-11          │ Vercel AI SDK + Ollama (alternative SDK, local model)│
├──────────────────────────┼──────────────────────────────────────────────────────┤
│ npm run typecheck:all    │ Type-check every step                                │
└──────────────────────────┴──────────────────────────────────────────────────────┘