# Step 8 — Hooks

Intercept the agent loop with pure TypeScript functions. Two flavours: **observability** (log every tool call) and **safety** (block dangerous ones).

## What's new

- The `hooks` option in `ClaudeAgentOptions`
- `HookCallback` — `(input, toolUseID, { signal }) => Promise<HookJSONOutput>`
- Returning `permissionDecision: "deny"` from a PreToolUse hook to block a tool call

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-8
```

You'll see lines like:

```
  [hook] Write → {"file_path":"…/notes.txt","content":"Use 'as const' to..."}
  [hook] Bash → {"command":"rm …/notes.txt"}
  ↑ blocked by hook
  [hook] Bash → {"command":"ls …"}
```

The agent tried to `rm`, got blocked, recovered, and continued.

## How it works

```ts
hooks: {
  PreToolUse: [
    { hooks: [logToolCalls] },                    // matcher omitted = all tools
    { matcher: "Bash", hooks: [blockDangerousBash] }, // matcher = tool name pattern
  ],
}
```

Each hook event (`PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, ...) takes an array of **matcher groups**. Each group runs its hooks against tool calls that match the `matcher` glob. Hooks within a group run in order; if any returns a deny, the chain short-circuits.

The hook callback gets:

```ts
async (input, toolUseID, { signal }) => {
  // input.tool_name, input.tool_input, etc.
  return {
    // empty = continue normally
    // or:
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny" | "allow" | "ask",
      permissionDecisionReason: "...",
      updatedInput: { ... },   // optionally rewrite the tool input
    },
  };
}
```

## Available hook events

A non-exhaustive subset; see `HOOK_EVENTS` in the SDK types for the full list.

| Event | When it fires |
|---|---|
| `PreToolUse` | Before a tool runs (most common) |
| `PostToolUse` | After a tool runs successfully |
| `PostToolUseFailure` | After a tool throws |
| `UserPromptSubmit` | When a new user message arrives |
| `SessionStart` / `SessionEnd` | Session boundaries |
| `Stop` | The agent thinks it's done (turn end) |
| `PermissionRequest` / `PermissionDenied` | Around permission checks |
| `SubagentStart` / `SubagentStop` | Subagent lifecycle |

## Hooks vs `canUseTool` vs `allowedTools`

|   | `allowedTools` | `canUseTool` | Hooks |
|---|---|---|---|
| **Where it lives** | Static config | Single callback | Per-event matcher groups |
| **What it can do** | Allow / deny | Allow / deny / ask | Allow / deny / ask / rewrite / observe |
| **Granularity** | Per tool name | Per tool call | Per event |
| **When to reach for it** | Coarse access control | Interactive permission UX (step 9) | Logging, auditing, safety rails, side-effects |

## Try this

- Add a `PostToolUse` hook that records latency per tool call to a CSV.
- Use `updatedInput` to redact a secret from any `Bash` command before it runs.
- Add a `Stop` hook that emits a desktop notification when the agent finishes (`SyncHookJSONOutput.terminalSequence` supports OSC 9).

## Next

[Step 9 — Permissions](../step-9-permissions): the *interactive* approval pattern (`canUseTool`), which is the higher-level cousin of PreToolUse hooks.
