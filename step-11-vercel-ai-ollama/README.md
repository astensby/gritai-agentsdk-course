# Step 11 — Vercel AI SDK + Ollama (alternative SDK)

The same agent pattern (MCP + skills + custom tools) — but with the **Vercel AI SDK v6** and a **local Ollama** model instead of the Claude Agent SDK + Claude API.

This step is the **contrast lesson**: agent concepts are portable across SDKs. Only the glue code changes.

## What's new vs the Claude SDK steps

|   | Claude Agent SDK | Vercel AI SDK |
|---|---|---|
| Main entry | `query({ prompt, options })` | `streamText({ model, system, prompt, tools, stopWhen })` |
| Provider | `@anthropic-ai/claude-agent-sdk` (Claude only) | `ai` (multi-provider) — here via `ollama-ai-provider-v2` |
| Loop control | Built-in, auto-iterates | Explicit `stopWhen: stepCountIs(N)` |
| MCP integration | Native `mcpServers` option | `createMCPClient` from `@ai-sdk/mcp` |
| Custom tools | `createSdkMcpServer + tool()` | `tool({ inputSchema, execute })` from `ai` |
| Skills | Auto-discovered from `.claude/skills/` via `settingSources` | **Not built-in** — `src/skills.ts` loads them manually |
| Model | Claude (`claude-sonnet-4-6`) | Any Ollama model (`llama3.3`, `qwen2.5-coder`, ...) |

## Prerequisites

Beyond the rest of the workshop, this step needs **Ollama** running locally:

```bash
# Install (macOS)
brew install ollama

# Start the server (leave running in another terminal)
ollama serve

# Pull a tool-capable model. Larger = better at tool use.
ollama pull llama3.3                # or: qwen2.5-coder, mistral-nemo, granite3
```

## Run it

```bash
npm run step-11
```

By default it uses `llama3.3`. Swap models via env var:

```bash
OLLAMA_MODEL=qwen2.5-coder:14b npm run step-11
```

The agent will:

1. Load skills from `./.claude/skills/` (the same convention as step 4)
2. Inject them into the system prompt as "available skills" with usage guidance
3. Launch a filesystem MCP server (same as step 2)
4. Receive raw meeting notes and a prompt to format + save them
5. Loop: call model → see tool request → run tool → repeat (up to 8 steps)

If the model is competent at tool use, you'll find a formatted summary in `./sandbox/formatted.md`.

## How the skill system works here

The Vercel AI SDK has no skills primitive — so we built a tiny loader in `src/skills.ts`:

```ts
const skills = await loadSkills(".claude/skills");
// → [{ name, description, body }]

const block = formatSkillsAsSystemBlock(skills);
// → "# Available Skills\n## meeting-notes-formatter\n**When to use:** ..."

streamText({
  system: `You are a helpful agent.${block}`,
  // ...
});
```

That's the entire skill mechanism. It puts every skill into the system prompt all at once. Compare to the Claude Agent SDK, which discovers skills the same way but is smarter about which one applies (and only includes the body when it matches).

This is fine for one or two skills; it scales badly past ~5 because the system prompt gets huge.

## Honest caveats with Ollama

The Agent SDK was tuned for Claude. Most local models, especially the small ones (<30B), are flaky at:

- **Tool calling format** — they may hallucinate JSON or skip tools entirely. Pick a model whose model card explicitly lists "tool calling" or "function calling" support.
- **Multi-step planning** — chaining 3+ tool calls compounds errors. `stepCountIs(8)` is a safety net, not an aspiration.
- **Following skill templates** — small models drift from the template format. Larger models (70B+) handle it.
- **Long system prompts** — local context windows are smaller. Don't load 10 skills into a 7B model.

What does work reliably on most tool-capable Ollama models:

- Single tool calls (the weather tool here)
- Following a skill template when the prompt is short
- Single MCP read or write

What's painful:

- Subagents (step 7 patterns) — don't try
- Hooks/permissions — work fine, they're SDK-side
- Skills with complex templates — Claude follows them; small models improvise

## When to use which SDK

| Use this SDK | When... |
|---|---|
| **Claude Agent SDK** | Building production-quality agents. Best tool calling + skill discovery + sub-agents. Premium Claude-only. |
| **Vercel AI SDK** | Multi-provider freedom. Use with Claude, GPT, Gemini, or local models. Smaller surface area; you wire more yourself. |

For a workshop, the Claude Agent SDK is the right teaching default — it lets the agent ideas land before the participants worry about SDK plumbing. This step exists so they can see the same ideas in another shape, and pick the right tool for their own projects.

## Try this

- Swap `qwen2.5-coder:14b` and observe whether the model uses the skill correctly. Then try a 7B model and watch it drift.
- Add a second skill (`code-explainer`?) and prompt for code review. Notice the model has to choose between two skills based only on description matching.
- Replace `ollama()` with `anthropic('claude-sonnet-4-6')` from `@ai-sdk/anthropic` and rerun. Same code, much better results — that's the model quality gap.
- Add `experimental_telemetry: { isEnabled: true }` to `streamText` to see every step the agent took.
