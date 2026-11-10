# Step 7 — Subagents

A main agent that delegates specialist work to **subagents**. This is the single most-asked-about Agent SDK pattern and the canonical "putting it all together in Agents" idea from Day 2.

## What's new

- The `agents` option in `ClaudeAgentOptions`
- The built-in delegation tool (`Agent`; older CLIs called it `Task`, still accepted as an alias) — how the main agent dispatches to subagents
- A "coordinator + specialists" pattern: one main agent, two subagents (`code-reviewer`, `test-planner`)
- **Background dispatch** — subagents now run in the background by default, which changes both the trace and how you read the stream

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-7
```

Watch the trace — you'll see the main agent dispatch two `Agent` calls (one per subagent; the tool is `Agent` on current CLIs, `Task` on older ones), each subagent reports back, and the main agent synthesizes a final summary.

## How it works

```ts
options: {
  allowedTools: ["Read", "Agent", "Task"],  // ← main agent needs the delegation tool (Agent/Task) to dispatch
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

The main agent's system prompt is automatically augmented with a list of available subagents (taken from each `description`). When the main agent decides to delegate, it emits an `Agent` tool call (named `Task` on older CLIs) with `subagent_type: "code-reviewer"` and a prompt for the subagent. The SDK spins up a fresh agent loop for that subagent with its own context and tools, and returns the final result to the main agent.

## Background by default

The `Agent` tool takes a `run_in_background` flag, and it defaults to **true**.
Left alone, the coordinator fires both subagents, says "they're running in the
background", and **ends its turn** — so the stream emits a `result` message,
with a cost, *before* either subagent has reported. The real answer arrives
later, in a second turn, with its own `result`.

That's genuinely useful for long-running work, and confusing the first time you
read the trace: three cost lines where you expected one, and a puzzling "it
finished, but where's the summary?" gap in between. This step asks for the
foreground explicitly to restore the linear dispatch → report → summarise
trace.

Two consequences for the consumer loop, both worth showing:

```ts
// 1. A stream can contain MORE THAN ONE `result`. `result` means "a turn
//    ended", not "the run is over" — so keep the last one, don't print each.
let finalCostUsd = 0;

for await (const message of response) {
  if (message.type === "assistant") {
    // 2. Subagent messages carry a `parent_tool_use_id`; the coordinator's own
    //    are null. Without this filter both subagents' full transcripts
    //    interleave into stdout and bury the summary you asked for.
    if (message.parent_tool_use_id) continue;
    // ...
  } else if (message.type === "result") {
    finalCostUsd = message.total_cost_usd;
  }
}
```

## Forks

The main agent can also fork itself (`subagent_type: "fork"`). This is on by default in SDK sessions. To opt out, add `disallowedTools: ["Agent(fork)"]`. A subagent's own `Agent` calls run in the foreground by default.

## Why subagents

- **Context isolation** — a subagent's intermediate reasoning doesn't pollute the main agent's context window
- **Specialization** — each subagent has its own focused system prompt and tool whitelist
- **Parallelism** — the main agent can dispatch multiple subagents concurrently; with background dispatch that's now the default
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

- Drop the "run both subagents in the FOREGROUND" line from the prompt and re-run. Count the `result` messages and watch the summary arrive in a later turn — that's the new default.
- Add a third subagent `security-auditor` that focuses only on security. Watch the main agent route differently.
- Swap `model: "haiku"` on `test-planner` (cheaper). The other can stay on Sonnet.
- Drop **both** `Agent` and `Task` from the main agent's `allowedTools` (they're the same tool — `Task` is just the legacy alias, so removing only one still lets it dispatch). With both gone, the agents are configured but the main agent can no longer reach them — useful test.

## Next

[Step 8 — Hooks](../step-8-hooks): intercept the tool loop with logging, auditing, or blocking.
