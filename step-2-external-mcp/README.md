# Step 2 — External MCP Server

Plug an existing MCP server into the agent. The agent gains real-world tools.

## What's new vs step 1

- `mcpServers` option on `query()` — declares MCP servers the agent can use
- `allowedTools` option — the **mandatory whitelist** for MCP tools
- `disallowedTools` — the one that actually *removes* a tool, rather than auto-approving it
- `cwd` — because the MCP **roots** protocol lets it override the server's own sandbox argument
- The agent now runs a tool loop autonomously (call tool → observe → decide → respond)

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-2
```

Then look in `./sandbox/` — there should be a `haiku.txt` with a freshly-written haiku.

## How it works

```ts
cwd: sandboxDir,                                              // ← see "the roots gotcha" below
mcpServers: {
  fs: {                                                       // ← key becomes tool prefix
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@2026.8.31", sandboxDir],
  },
}
```

The SDK spawns that command, speaks the **Model Context Protocol** over its stdin/stdout, and exposes its tools to the agent under the name `mcp__fs__<tool>`. The official `@modelcontextprotocol/server-filesystem` package gives you `read_text_file` (and the now-deprecated `read_file`), `write_file`, `list_directory`, etc., scoped to the directory you pass as an argument.

Note the **version pinned in `args`**, not just in `package.json`. `npx -y <pkg>` with no version uses a local install if there is one and otherwise fetches *latest* at run time — so an unpinned arg only looks pinned while you're inside this workspace. Copy the folder out and it silently starts tracking latest.

## The roots gotcha

The directory passed on the command line is only a **fallback**. The filesystem server also speaks the MCP **roots** protocol: on connect it asks the client for its roots and, if it gets any, *replaces* its allowed directories with them. The SDK's root is its `cwd`.

So without `cwd: sandboxDir`, the server's sandbox silently becomes the step folder, and the agent writes `haiku.txt` next to `package.json` instead of into `sandbox/`. Setting `cwd` makes the root and the CLI argument agree. This bites in steps 5 and 6 too.

## The whitelist gotcha

Without `allowedTools`, the agent sees no MCP tools — even though they're declared. The SDK denies all MCP tools by default. Pick one:

```ts
allowedTools: ["mcp__fs__*"]                          // wildcard: easy, broad
// or
allowedTools: ["mcp__fs__write_file",                 // explicit: principle of least privilege
                "mcp__fs__read_text_file"]
```

The MCP server itself decides what tools it offers; `allowedTools` is just the agent-side permission gate.

The code in this step uses the **explicit form** to model principle-of-least-privilege. For quick prototyping, the wildcard is fine.

## `allowedTools` is not a sandbox

`allowedTools` is an **auto-approve** list — it does not remove anything. The built-in `Write`/`Edit`/`Bash` tools still exist and are what a modern model reaches for first on a file task; they just prompt. Headless, a prompt is an automatic denial, so the run dies with nothing written. `disallowedTools` is what actually takes them away:

```ts
disallowedTools: ["Write", "Edit", "Bash"],
```

That, plus a prompt that names the `fs` server explicitly, is what keeps this step on the MCP path. ([Step 2b](../step-2b-builtin-tools) flips it around and uses the built-ins on purpose.)

## Try this

- Comment out the `allowedTools` line and rerun. The agent will refuse to create the file. That's the gotcha in action.
- Add `"mcp__fs__list_directory"` to the prompt's request: *"List the files in your sandbox, then create..."*. Watch the extra tool call show up in the trace.
- Swap `@modelcontextprotocol/server-filesystem` for another stdio MCP server (e.g., `@modelcontextprotocol/server-memory`). The pattern is identical. (GitHub's old `@modelcontextprotocol/server-github` is deprecated — GitHub now ships its own server, and it's remote, which is [step 2c](../step-2c-mcp-transports)'s HTTP transport.)

## Next

In [step 3](../step-3-custom-mcp), instead of using somebody else's MCP server, we'll **write our own tools** in plain TypeScript and expose them via the SDK's in-process MCP helper.
