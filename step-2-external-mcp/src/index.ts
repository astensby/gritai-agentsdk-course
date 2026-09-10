import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// We give the agent access to a sandbox folder via an EXTERNAL MCP server —
// in this case, the official filesystem server from Anthropic / MCP team.
// The SDK launches it as a subprocess over stdio.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxDir = path.resolve(__dirname, "..", "sandbox");

const response = query({
  // Be explicit that the FILESYSTEM SERVER is the route. Modern models default
  // to the built-in Write/Bash tools for a file task — they're always present
  // and cheaper to reach for — and those are not in `allowedTools` below, so
  // the run dies on a permission denial with nothing written. Naming the server
  // (and letting it tell us its own allowed directory) keeps the agent on the
  // MCP path this step is about. `disallowedTools` below is the other half.
  prompt: `Use the 'fs' filesystem tools for every step of this task.

First call list_allowed_directories to find the directory you may write to.
Then create 'haiku.txt' in that directory with a short haiku about coffee.
Then read it back to confirm.`,
  options: {
    model: "claude-sonnet-5",

    // *** MCP ROOTS — the gotcha that bites hardest here. ***
    // The directory we pass on the command line below is only a FALLBACK.
    // The filesystem server also speaks the MCP "roots" protocol: on connect it
    // asks the client (this SDK) for its roots and, if it gets any, REPLACES its
    // allowed directories with them. The SDK's root is its `cwd`. So without the
    // line below the server's sandbox silently becomes the step folder, and the
    // agent writes `haiku.txt` next to package.json instead of into sandbox/.
    // Setting `cwd` makes the root and the CLI argument agree.
    cwd: sandboxDir,

    // Configure MCP servers. The KEY here ("fs") becomes part of the tool
    // name the model sees: tools are auto-namespaced as `mcp__fs__<tool>`.
    mcpServers: {
      fs: {
        // stdio transport: the SDK runs this command and talks MCP over stdin/stdout.
        command: "npx",

        // PIN THE VERSION IN THE ARGS, not just in package.json. `npx -y <pkg>`
        // with no version uses the local install if there is one and otherwise
        // FETCHES LATEST at run time — so an unpinned arg only looks pinned
        // while you're inside this workspace. Copy the folder out (which the
        // README invites you to do) and it silently starts tracking latest.
        // This server changed its sandbox semantics in a release mid-2026, so
        // "latest" is not a safe default here.
        // Keep this in sync with the dependency in package.json.
        args: ["-y", "@modelcontextprotocol/server-filesystem@2026.8.31", sandboxDir],
      },
    },

    // *** The easiest line in this file to forget. ***
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
      "mcp__fs__list_allowed_directories",
    ],

    // `allowedTools` is an AUTO-APPROVE list, not a sandbox — the built-in
    // Write/Edit/Bash tools still EXIST, they just prompt. Headless, a prompt
    // is an automatic denial, so an agent that reaches for Write here simply
    // fails. Removing the built-ins outright is what actually keeps this step
    // on the MCP path. (Step 2b flips this around and uses the built-ins on
    // purpose; step 10 relies on the same distinction.)
    disallowedTools: ["Write", "Edit", "Bash"],
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
