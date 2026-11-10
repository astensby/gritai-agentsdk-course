import readline from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  query,
  type CanUseTool,
  type PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";

// `canUseTool` is the INTERACTIVE permission pattern — the "Claude wants to
// run X — allow?" prompt you've seen in Claude Code itself.
//
// Whereas:
//   - `allowedTools` is a static whitelist
//   - PreToolUse hooks are programmatic (deny on a regex, etc.)
// canUseTool is a single async callback the SDK calls for any tool use
// that nothing earlier has settled (see the README) — and you can ask the
// human whatever you want before deciding.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxDir = path.resolve(__dirname, "..", "sandbox");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Remember decisions per tool so we don't ask the same question twice.
const alwaysAllow = new Set<string>();

const canUseTool: CanUseTool = async (toolName, input, opts): Promise<PermissionResult> => {
  if (alwaysAllow.has(toolName)) {
    return { behavior: "allow", updatedInput: input };
  }

  // The SDK gives us a pre-rendered prompt sentence when available.
  const prompt = opts.title ?? `Allow tool: ${toolName}?`;
  const summary = JSON.stringify(input).slice(0, 120);

  console.log(`\n┌─ Permission request ──────────────────────`);
  console.log(`│ ${prompt}`);
  console.log(`│ Input: ${summary}`);
  console.log(`└────────────────────────────────────────────`);

  const answer = (await rl.question("[y]es / [n]o / [a]lways allow > "))
    .trim()
    .toLowerCase();

  if (answer === "a") {
    alwaysAllow.add(toolName);
    return { behavior: "allow", updatedInput: input };
  }
  if (answer === "y" || answer === "") {
    return { behavior: "allow", updatedInput: input };
  }
  return {
    behavior: "deny",
    message: `User declined ${toolName}. Don't retry — explain what you would have done instead.`,
  };
};

const response = query({
  prompt: `Create a file called pizza.txt in ${sandboxDir} with a short pizza recipe. Then read it back, then run 'ls' on the sandbox folder.`,
  options: {
    model: "claude-sonnet-5-5",

    // NOTE: we deliberately leave allowedTools empty so every call that
    // needs approval reaches canUseTool. Calls that approve themselves, like
    // a Read in the working directory or a read-only `ls`, never get here.
    // In a real app you'd allowedTools the
    // cheap/safe tools (Read, Glob, Grep) and only prompt for the risky
    // ones (Write, Edit, Bash).
    allowedTools: [],
    additionalDirectories: [sandboxDir],
    canUseTool,

    // Other relevant permissionMode values:
    //   "default"       — ask via canUseTool (what we use)
    //   "acceptEdits"   — auto-allow file edits (still ask for Bash etc.)
    //   "bypassPermissions" — YOLO, no prompts (also requires allowDangerouslySkipPermissions: true)
    //   "plan"          — research-only mode; agent produces a plan instead of acting
    //   "dontAsk"       — never prompt; deny anything not pre-approved (headless)
    //   "auto"          — a model classifier approves/denies each prompt
    //
    // Note: PermissionResult only has `behavior: "allow" | "deny"`. The
    // third value `"ask"` you may see in the SDK types is for hook outputs
    // (PreToolUseHookSpecificOutput.permissionDecision), NOT for canUseTool.
    permissionMode: "default",
  },
});

try {
  for await (const message of response) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    } else if (message.type === "result") {
      console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
    }
  }
} finally {
  rl.close();
}
