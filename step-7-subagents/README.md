# Step 7 — Subagents

A main agent that delegates specialist work to **subagents**. This is the single most-asked-about Agent SDK pattern and the canonical "putting it all together in Agents" idea from Day 2.

## What's new

- The `agents` option in `ClaudeAgentOptions`
- The built-in `Task` tool — how the main agent dispatches to subagents
- A "coordinator + specialists" pattern: one main agent, two subagents (`code-reviewer`, `test-planner`)

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-7
```

Watch the trace — you'll see the main agent dispatch two `Task` calls (one per subagent), each subagent reports back, and the main agent synthesizes a final summary.

## How it works

```ts
options: {
  allowedTools: ["Read", "Task"],           // ← main agent needs Task to dispatch
  agents: {
    "code-reviewer": {
      description: "...",                   // ← main agent uses this to decide WHEN to dispatch
      prompt: "...",                        // ← the subagent's system prompt
      tools: ["Read", "Grep"],              // ← the subagent's own allowed tools
    },
    "test-planner": { ... }
  }
}
```

The main agent's system prompt is automatically augmented with a list of available subagents (taken from each `description`). When the main agent decides to delegate, it emits a `Task` tool call with `subagent_type: "code-reviewer"` and a prompt for the subagent. The SDK spins up a fresh agent loop for that subagent with its own context and tools, and returns the final result to the main agent.

## Why subagents

- **Context isolation** — a subagent's intermediate reasoning doesn't pollute the main agent's context window
- **Specialization** — each subagent has its own focused system prompt and tool whitelist
- **Parallelism** — the main agent can dispatch multiple subagents (in some patterns concurrently)
- **Composition** — subagents can themselves dispatch sub-subagents (use with care)

## AgentDefinition fields worth knowing

| Field | What it does |
|---|---|
| `description` | Drives the main agent's decision to dispatch — be specific |
| `prompt` | System prompt for the subagent |
| `tools` | Allowed tools (defaults to inheriting parent's tools) |
| `model` | Pin a different model (e.g. `"haiku"` for cheap parallel work) |
| `maxTurns` | Cap on agentic round-trips before the subagent gives up |
| `skills` | Skill names to preload into the subagent |
| `disallowedTools` | Explicit deny list |

## Try this

- Add a third subagent `security-auditor` that focuses only on security. Watch the main agent route differently.
- Swap `model: "haiku"` on `test-planner` (cheaper). The other can stay on Sonnet.
- Drop `Task` from the main agent's `allowedTools`. The agents are configured but the main agent can no longer reach them — useful test.

## Next

[Step 8 — Hooks](../step-8-hooks): intercept the tool loop with logging, auditing, or blocking.
