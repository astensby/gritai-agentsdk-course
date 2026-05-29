import path from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "@anthropic-ai/claude-agent-sdk";

// One MAIN agent (the "coordinator") delegates work to two SUBAGENTS:
//   - code-reviewer: spots bugs, security issues, code smells
//   - test-planner:  proposes a test plan for the same code
//
// The main agent uses the built-in `Task` tool to spin up each subagent.
// Each subagent runs in its own context with its own system prompt and
// tool whitelist — keeps the main agent's context lean and gives each
// subagent a tight, single-responsibility role.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDir = path.resolve(__dirname, "..", "sample");

const response = query({
  prompt: `Use the code-reviewer and test-planner subagents to analyze ${path.join(sampleDir, "auth.ts")}. Then give me a final summary in 5 bullet points.`,
  options: {
    model: "claude-sonnet-4-6",

    // The main agent gets Read + Task. Task is how it delegates to subagents.
    allowedTools: ["Read", "Task"],
    additionalDirectories: [sampleDir],

    // Each entry under `agents` defines a subagent. The key is the name
    // the main agent uses when calling Task.
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

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        // Watch the coordinator dispatch Task calls — each one spawns a subagent.
        if (block.name === "Task") {
          const input = block.input as { subagent_type?: string };
          console.log(`\n\n[dispatch] subagent: ${input.subagent_type}`);
        }
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
  }
}
