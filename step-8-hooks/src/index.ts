import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  query,
  type HookCallback,
  type PreToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";

// HOOKS let you intercept the agent loop. They fire on events like
// PreToolUse (before a tool runs), PostToolUse (after), Stop (turn done),
// SessionStart, SessionEnd, and many more.
//
// Two patterns we'll demo:
//
//  1. PreToolUse for OBSERVABILITY — print every tool call as it happens.
//  2. PreToolUse for SAFETY — block any Bash command that contains "rm ".
//
// Hooks are pure functions (not config) and run in your process — so they
// can do anything: write logs, send metrics, decide allow/deny, even
// rewrite the tool input.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sandboxDir = path.resolve(__dirname, "..", "sandbox");

// --- Hook 1: log every tool call ---------------------------------------------
const logToolCalls: HookCallback = async (input, toolUseID) => {
  const i = input as PreToolUseHookInput;
  const full = JSON.stringify(i.tool_input);
  const summary = full.slice(0, 80);
  console.log(`  [hook] ${i.tool_name} → ${summary}${full.length > 80 ? "…" : ""}`);
  // Empty return = continue normally. The agent doesn't know we ran.
  return {};
};

// --- Hook 2: block dangerous shell commands ---------------------------------
// Registered with matcher: "Bash", so it only ever receives Bash calls.
const blockDangerousBash: HookCallback = async (input) => {
  const i = input as PreToolUseHookInput;
  const cmd = (i.tool_input as { command?: string }).command ?? "";
  // Match any `rm` (with or without flags) and any `sudo`. Keeping it to a
  // bare `\brm\b` means the block fires even on a plain `rm notes.txt` —
  // a real deny rule would need more care than a substring match.
  if (/\brm\b/i.test(cmd) || /\bsudo\b/i.test(cmd)) {
    console.log("  ↑ blocked by hook");
    return {
      // `deny` short-circuits before the tool runs. The agent gets a
      // tool_result it can read, recover from, or apologize for.
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Hook blocked: rm/sudo commands are not allowed in this demo.",
      },
    };
  }
  return {};
};

const response = query({
  prompt: `Write a file called notes.txt in ${sandboxDir} with one TypeScript tip, then try to delete it with rm. After that, list the files in ${sandboxDir}.`,
  options: {
    model: "claude-sonnet-4-6",
    allowedTools: ["Read", "Write", "Bash"],
    additionalDirectories: [sandboxDir],

    // Hooks are grouped by event, then by matcher. The matcher is a
    // tool-name pattern; "*" / undefined means "all tools".
    hooks: {
      PreToolUse: [
        { hooks: [logToolCalls] },                  // fires for every tool
        { matcher: "Bash", hooks: [blockDangerousBash] }, // fires only for Bash
      ],
    },
  },
});

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
