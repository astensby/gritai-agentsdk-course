import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Step 2 plugged in someone else's MCP server over stdio. This step shows the
// two transports you'll actually reach for in the wild:
//
//   1. a LOCAL server running on your machine, launched as a subprocess (stdio)
//   2. a REMOTE server running somewhere else, reached over HTTP
//
// The agent doesn't care which is which — both just become `mcp__<key>__<tool>`.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policeServer = path.resolve(__dirname, "..", "server", "police-mcp.ts");

const response = query({
  prompt: `What are the latest police incidents in Norway right now? Summarise a few, with location and time.`,
  options: {
    model: "claude-sonnet-5",

    mcpServers: {
      // ── LOCAL MCP server (stdio transport) ─────────────────────────────
      // The KEY ("police") becomes the tool prefix: mcp__police__<tool>.
      // The SDK runs this command and speaks MCP over its stdin/stdout. Our
      // server is TypeScript, so we launch it with `tsx` — but it could be any
      // executable (python, a compiled binary, npx ...). It just has to speak
      // MCP on stdio. See ../server/police-mcp.ts for the server itself.
      police: {
        command: "npx",
        args: ["tsx", policeServer],

        // *** TOOL SEARCH — why you'll see an extra `ToolSearch` call. ***
        // MCP tool schemas are no longer all pasted into the prompt. Tool search
        // is on by default, so MCP tools are DEFERRED: the model first calls
        // `ToolSearch` to find them by name, then calls the tool it found. That
        // keeps the context window small when you have 200 tools mounted — but
        // it costs a round-trip, and a tool the model never searches for is a
        // tool it never uses (so tool NAMES and DESCRIPTIONS now matter even
        // more than before).
        //
        // `alwaysLoad: true` pins this server's tools into the prompt like the
        // old behaviour. Worth it for a handful of tools the agent needs on
        // turn 1; the trade-off is that startup now blocks until this server
        // connects (5s cap), because the schemas must exist when the first
        // prompt is built. Comment it out and re-run to watch `ToolSearch`
        // reappear in the trace.
        alwaysLoad: true,
      },

      // ── REMOTE MCP server (HTTP transport) ─────────────────────────────
      // Same idea, no subprocess: the server already runs in the cloud and the
      // SDK talks to it over (streamable) HTTP. You give it a `type` and a
      // `url` instead of a `command`. Uncomment to add Norway's live public-
      // transport data (Entur) to the SAME agent — then add its tools to
      // `allowedTools` below and ask something like "When's the next departure
      // from Oslo S?".
      //
      // entur: {
      //   type: "http",
      //   url: "https://gritai-mcp-entur-839452109027.europe-north1.run.app/mcp",
      //   // Most remote servers need auth — you'd pass it as a header:
      //   // headers: { Authorization: `Bearer ${process.env.ENTUR_TOKEN}` },
      // },
    },

    // Same default-deny gotcha as step 2: MCP tools are denied until you list
    // them. Names are namespaced by the mcpServers KEY, not the server's own
    // name — so it's `mcp__police__*`, matching the "police" key above.
    allowedTools: [
      "mcp__police__latest_incidents",
      "mcp__police__incidents_by_district",
      // For the remote Entur server you'd whitelist its tools too, e.g.:
      // "mcp__entur__find_stop",
      // "mcp__entur__get_departures",
      // "mcp__entur__plan_trip",
    ],
  },
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        // Useful while learning: see every tool the agent decides to call,
        // and which server (prefix) it came from.
        console.log(`\n[tool call] ${block.name}(${JSON.stringify(block.input)})`);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
  }
}
