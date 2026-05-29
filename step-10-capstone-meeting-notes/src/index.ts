import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, type PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

// CAPSTONE — the workshop in one agent.
//
// One job: turn every raw transcript in ./transcripts/ into a formatted
// summary in ./output/. To do it, the agent uses:
//
//   - The Glob built-in tool          (find transcripts)
//   - The Read built-in tool          (read each one)
//   - The meeting-notes-formatter SKILL (decides the output format)
//   - The Write built-in tool         (save the result)
//   - A PreToolUse HOOK               (log every step so you can watch it work)
//
// That's: built-in tools (step 2b) + skills (step 4) + hooks (step 8),
// composed into a small useful agent. No MCP needed — this could be a CLI
// tool you ship.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const transcriptsDir = path.join(projectDir, "transcripts");
const outputDir = path.join(projectDir, "output");

const response = query({
  prompt: `Process every .txt file in ${transcriptsDir}:

1. Read each transcript.
2. Use the meeting-notes-formatter skill to convert it into a structured summary.
3. Save the summary to ${outputDir}, using the same basename but with a .md extension
   (e.g., 2026-05-12-q3-launch.txt → 2026-05-12-q3-launch.md).
4. When you're done, print a one-line summary: "Processed N transcripts → output/."

Don't skip any files. Don't add anything that isn't in the source transcripts.`,

  options: {
    model: "claude-sonnet-4-6",

    // This job only needs Glob/Read/Write. Note `allowedTools` AUTO-APPROVES
    // those (so they run without a prompt) — it does NOT remove the others.
    // To actually keep the agent off the shell we add `disallowedTools`;
    // without it, the agent would happily reach for Bash (e.g. `ls`, `mkdir`).
    allowedTools: ["Glob", "Read", "Write"],
    disallowedTools: ["Bash"],
    additionalDirectories: [transcriptsDir, outputDir],

    // Scope skill discovery to this project's .claude/ folder so the run is
    // reproducible — independent of whatever you have in ~/.claude. (The SDK
    // default ["user","project","local"] already loads project skills; setting
    // it explicitly just narrows the search.) See step 4 for the full story.
    settingSources: ["project"],

    // Observe every tool call so the workshop audience can see what's happening.
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input) => {
              const i = input as PreToolUseHookInput;
              const summary = JSON.stringify(i.tool_input).slice(0, 100);
              console.log(`  · ${i.tool_name}(${summary}${summary.length >= 100 ? "…" : ""})`);
              return {};
            },
          ],
        },
      ],
    },
  },
});

console.log("Running capstone agent...\n");

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---`);
    console.log(`Cost:     $${message.total_cost_usd.toFixed(6)}`);
    console.log(`Duration: ${message.duration_ms}ms`);
    console.log(`Output:   ${outputDir}`);
  }
}
