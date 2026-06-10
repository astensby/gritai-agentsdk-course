# Step 2c — Local & Remote MCP Servers

Step 2 plugged in an external MCP server with one line of config. This step zooms in on **where** an MCP server can live and **how** the SDK reaches it — the two transports you'll actually use in production:

- a **local** server running on your machine, launched as a subprocess (**stdio**)
- a **remote** server running somewhere else, reached over **HTTP**

The agent doesn't care which is which. Both just show up as `mcp__<key>__<tool>`.

## What's new vs step 2

- A **local MCP server you own** (`server/police-mcp.ts`) instead of an off-the-shelf one — a tiny stdio server over Norway's public police log (Politiloggen).
- The `type: "http"` transport for talking to a **remote** MCP server (shown with Norway's live transit server, Entur).
- Reinforces the step-2 `allowedTools` default-deny gotcha — it applies identically to both transports.

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-2c
```

No extra setup, no extra toolchain — the local server is plain TypeScript and runs under `tsx`, same as every other step. You should see the agent call `mcp__police__latest_incidents` and summarise the latest incidents.

## Local server (stdio)

```ts
mcpServers: {
  police: {                               // ← key becomes the tool prefix
    command: "npx",
    args: ["tsx", policeServer],          // path to ./server/police-mcp.ts
  },
}
```

The SDK runs that command, speaks MCP over its **stdin/stdout**, and exposes the
tools under `mcp__police__<tool>`. Our server happens to be TypeScript, so we
launch it with `tsx` — but the `command` can be anything that speaks MCP on
stdio: `python a_server.py`, a compiled binary, `npx -y some-package`, etc.
That's exactly what step 2 did with `@modelcontextprotocol/server-filesystem`.

`server/police-mcp.ts` is a complete, minimal MCP server (~150 lines): it
creates an `McpServer`, registers two tools with Zod input schemas, and connects
a `StdioServerTransport`. The one rule to remember when writing a stdio server:
**stdout is protocol-only** — all logging goes to `stderr`, or you corrupt the
stream the SDK is reading.

## Remote server (HTTP)

Same idea, no subprocess. The server already runs in the cloud; you point the
SDK at a URL instead of a command:

```ts
mcpServers: {
  entur: {
    type: "http",
    url: "https://gritai-mcp-entur-839452109027.europe-north1.run.app/mcp",
    // Most remote servers need auth — pass it as a header:
    // headers: { Authorization: `Bearer ${process.env.ENTUR_TOKEN}` },
  },
}
```

That's it — the tools become `mcp__entur__find_stop`, `mcp__entur__get_departures`,
`mcp__entur__plan_trip`, and so on. (`type: "sse"` exists too, for older servers
that use the separate Server-Sent-Events transport; new servers use `"http"`.)

In `src/index.ts` the Entur block is commented out so the step has a single,
reliable thing to run. Uncomment it, add a couple of its tools to `allowedTools`,
and change the prompt to something like *"When's the next departure from Oslo S?"*
to see one agent use a local and a remote server in the same turn.

## The whitelist gotcha (still applies)

`allowedTools` gates **both** transports — MCP tools are denied until listed, no
matter where the server runs. Names are namespaced by the mcpServers **key**, not
the server's own internal name:

```ts
allowedTools: [
  "mcp__police__latest_incidents",       // local
  "mcp__police__incidents_by_district",
  // "mcp__entur__get_departures",       // remote (when you wire it up)
]
```

## Try this

- Comment out `allowedTools` and rerun — the agent can't call the local tools, same as step 2.
- Uncomment the `entur` block + its tools, then ask a question that needs *both* servers (*"Any police incidents near Oslo S, and when's the next train from there?"*). Watch the tool trace pull from two prefixes.
- Open `server/police-mcp.ts` and add a third tool (e.g. filter by category). It appears to the agent the moment you whitelist `mcp__police__<your_tool>`.

## Next

In [step 3](../step-3-custom-mcp) we skip the subprocess entirely: the SDK can
host your tools **in-process** with `createSdkMcpServer` — no separate server
file, no stdio, just TypeScript functions the agent can call.
