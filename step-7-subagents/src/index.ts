import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// One MAIN agent (the "coordinator") delegates work to two SUBAGENTS:
//   - code-reviewer: spots bugs, security issues, code smells
//   - test-planner:  proposes a test plan for the same code
//
// The main agent uses the built-in delegation tool to spin up each subagent.
// Recent CLI versions renamed that tool from `Task` to `Agent` (with `Task`
// kept as an alias), so we allow-list both names and match both when we watch
// the coordinator dispatch. Each subagent runs in its own context with its own
// system prompt and tool whitelist — keeps the main agent's context lean and
// gives each subagent a tight, single-responsibility role.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDir = path.resolve(__dirname, "..", "sample");

// *** BACKGROUND SUBAGENTS — new, and it changes what you see on screen. ***
// The Agent tool now takes `run_in_background`, and it defaults to TRUE. Left
// alone, the coordinator fires both subagents, says "they're running in the
// background", and ENDS ITS TURN — so the stream emits a `result` message with
// a cost *before* either subagent has reported. The real answer arrives later,
// in a second turn, with its own `result`. So you get three cost lines where
// you expected one, and a puzzling "it finished, but where's the summary?"
// gap in between.
//
// Asking for the foreground restores the linear dispatch -> report -> summarise
// trace this step is here to show. Drop the line to see the background flow —
// it's genuinely useful for long-running work, just not for reading a trace.
const response = query({
  prompt: `Use the code-reviewer and test-planner subagents to analyze ${path.join(sampleDir, "auth.ts")}. Then give me a final summary in 5 bullet points.

Run both subagents in the FOREGROUND (run_in_background: false) and wait for each to finish before you summarise.`,
  options: {
    model: "claude-sonnet-5",

    // The main agent gets Read + the delegation tool. `Agent` is the current
    // name; `Task` is the legacy alias — list both so this works regardless
    // of the CLI version bundled with the installed SDK.
    allowedTools: ["Read", "Agent", "Task"],
    additionalDirectories: [sampleDir],

    // Each entry under `agents` defines a subagent. The key is the name
    // the main agent passes as `subagent_type` when it delegates.
    agents: {
      "code-reviewer": {
        description:
          "Reviews TypeScript code for bugs, security issues, and code smells. Returns a concise list of findings ranked by severity.",
        prompt: `You are a senior code reviewer. Read the file you're given and produce a bullet list:
- Critical: bugs that break correctness or security
- Major: design problems that will bite later
- Minor: style/clarity nits

Be specific: cite line numbers and quote the offending code. Don't speculate beyond what's in the file.`,
        tools: ["Read", "Grep"],
      },

      "test-planner": {
        description:
          "Proposes a test plan for a TypeScript file. Returns a checklist of test cases without writing actual test code.",
        prompt: `You are a test engineer. For the file you're given, produce a Markdown checklist of test cases that should exist:
- Happy paths
- Edge cases
- Failure / error modes
- Security-relevant invariants

Group by function. Don't write the actual tests — just the list of what should be tested.`,
        tools: ["Read"],
      },
    },
  },
});

// A stream can now contain MORE THAN ONE `result` message — one per turn, and
// a backgrounded subagent produces extra turns. So don't print on every result;
// keep the last one and report it after the stream closes. (This is the correct
// pattern regardless: `result` means "a turn ended", not "the run is over".)
let finalCostUsd = 0;

for await (const message of response) {
  if (message.type === "assistant") {
    // Skip anything a SUBAGENT said. Subagent messages carry a
    // `parent_tool_use_id`; the coordinator's own messages have it null. Without
    // this the two subagents' full transcripts interleave into stdout and bury
    // the 5-bullet summary we actually asked for.
    if (message.parent_tool_use_id) continue;

    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        // Watch the coordinator delegate — each call spawns a subagent.
        // Match both the current name (`Agent`) and the legacy alias (`Task`).
        if (block.name === "Agent" || block.name === "Task") {
          const input = block.input as { subagent_type?: string };
          console.log(`\n\n[dispatch] subagent: ${input.subagent_type}`);
        }
      }
    }
  } else if (message.type === "result") {
    finalCostUsd = message.total_cost_usd;
  }
}

console.log(`\n\n---\nCost: $${finalCostUsd.toFixed(6)}`);
