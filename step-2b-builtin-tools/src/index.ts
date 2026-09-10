import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Plot twist: step 2 used an EXTERNAL MCP server to read and write files.
// You don't need MCP for that. The Agent SDK ships with built-in file and
// shell tools: Read, Write, Edit, Bash, Glob, Grep — the same toolset
// Claude Code uses.
//
// Reach for MCP when you want to integrate with EXTERNAL services
// (GitHub, Slack, Postgres) or wrap YOUR OWN business logic.
// For local files? Just use the built-ins.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxDir = path.resolve(__dirname, "..", "sandbox");

const response = query({
  prompt: `Create a file called 'limerick.txt' in ${sandboxDir} with a short limerick about TypeScript. Then read it back to confirm.`,
  options: {
    model: "claude-sonnet-5",

    // Just whitelist the built-in tools by their bare names. No MCP at all.
    // (Tools without `mcp__` prefix are built-ins.)
    allowedTools: ["Read", "Write", "Bash"],

    // Built-in file tools are scoped to additionalDirectories.
    // Without this, the agent can only touch CWD and below.
    additionalDirectories: [sandboxDir],
  },
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        console.log(`\n[tool call] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
    console.log("Check ./sandbox/limerick.txt");
  }
}
