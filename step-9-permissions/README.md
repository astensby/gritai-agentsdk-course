# Step 9 — Interactive Permissions

The "Claude wants to run X — allow?" pattern you've seen in Claude Code itself. Step 8's hooks are programmatic; this is the *interactive* cousin.

## What's new

- The `canUseTool` callback in `ClaudeAgentOptions`
- The `PermissionResult` shape (`allow` / `deny`)
- The `permissionMode` option (`default` / `acceptEdits` / `plan` / `bypassPermissions`)

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-9
```

For every tool the agent wants to use, you'll see:

```
┌─ Permission request ──────────────────────
│ Claude wants to write …/pizza.txt
│ Input: {"file_path":"…/pizza.txt","content":"…"}
└────────────────────────────────────────────
[y]es / [n]o / [a]lways allow > 
```

Hit `y`, `n`, or `a`. `a` remembers your decision for that tool for the rest of the session.

## How it works

```ts
const canUseTool: CanUseTool = async (toolName, input, opts) => {
  // ask the user...
  return {
    behavior: "allow",
    updatedInput: input,         // optional: rewrite before running
  };
  // or:
  return {
    behavior: "deny",
    message: "User declined."     // ← the agent sees this as tool_result
  };
};

options: {
  allowedTools: [],   // ← empty: nothing is auto-allowed
  canUseTool,
}
```

A tool call goes through this order:

1. **Is it in `allowedTools`?** → run immediately
2. **Else, do PreToolUse hooks say deny?** → block (step 8 pattern)
3. **Else, is there a `canUseTool` callback?** → call it, use its decision
4. **Else** → default to deny

## `permissionMode` cheat sheet

| Mode | Behaviour |
|---|---|
| `default` | Route uncertain tools through `canUseTool` |
| `acceptEdits` | Auto-allow file edits, still ask for Bash/network |
| `plan` | Research-only mode — agent produces a plan, doesn't act |
| `bypassPermissions` | Auto-allow everything. **Dangerous.** Requires `allowDangerouslySkipPermissions: true` |
| `dontAsk` | Auto-deny anything not in `allowedTools` (good for headless agents) |
| `auto` | A model classifier approves/denies each prompt for you |

## `PermissionResult` returning `updatedInput`

The callback can **rewrite** the input before the tool runs:

```ts
return {
  behavior: "allow",
  updatedInput: { ...input, command: input.command.replace(/--force/g, "") },
};
```

Useful for stripping risky flags, redacting secrets, or pinning paths.

## Try this

- Switch to `permissionMode: "plan"` and rerun. The agent produces a plan without touching the filesystem.
- Put `Read` and `Glob` into `allowedTools` so only the risky ones (Write, Bash) prompt.
- Wire `canUseTool` into a Slack DM bot — same callback shape, different transport.

## Next

[Step 10 — Capstone: meeting-notes agent](../step-10-capstone-meeting-notes): compose built-ins, a skill, and a hook into one useful agent.
