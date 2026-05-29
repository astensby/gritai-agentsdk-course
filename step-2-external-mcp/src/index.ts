import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// We give the agent access to a sandbox folder via an EXTERNAL MCP server —
// in this case, the official filesystem server from Anthropic / MCP team.
// The SDK launches it as a subprocess over stdio.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxDir = path.resolve(__dirname, "..", "sandbox");

const response = query({
  prompt: `Create a file called 'haiku.txt' in your working directory. Write a short haiku about coffee inside it. Then read it back to confirm.`,
  options: {
    model: "claude-sonnet-4-6",

    // Configure MCP servers. The KEY here ("fs") becomes part of the tool
    // name the model sees: tools are auto-namespaced as `mcp__fs__<tool>`.
    mcpServers: {
      fs: {
        // stdio transport: the SDK runs this command and talks MCP over stdin/stdout.
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", sandboxDir],
      },
    },

    // *** This is the line participants most commonly forget. ***
    // MCP tools are denied by default. You MUST whitelist them.
    // Wildcards work (`mcp__fs__*`). Explicit names give you tighter
    // principle-of-least-privilege. We list the ones this step needs.
    // Note: this server now prefers `read_text_file` and marks `read_file`
    // deprecated, so we allow both — otherwise the "read it back" step can be
    // silently denied when the model picks the newer name.
    allowedTools: [
      "mcp__fs__write_file",
      "mcp__fs__read_text_file",
      "mcp__fs__read_file",
      "mcp__fs__list_directory",
    ],
  },
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        // Useful while learning: see every tool the agent decides to call.
        console.log(`\n[tool call] ${block.name}(${JSON.stringify(block.input)})`);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
    console.log(`Check ./sandbox/ — the file should be there.`);
  }
}
