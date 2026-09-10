import { query } from "@anthropic-ai/claude-agent-sdk";

// The simplest possible Claude Agent SDK program.
//
// `query()` returns an async iterable of messages. The SDK runs the full
// agent loop internally (model call → tool use → model call → ...) and emits
// a stream of typed messages: `system`, `assistant`, `user`, `result`.
//
// For a one-shot prompt with no tools, we'll typically see:
//   1. one `system` (init) message
//   2. one or more `assistant` messages with the response
//   3. one `result` message with cost + duration

const response = query({
  prompt: "Explain what an AI agent is in three sentences.",
  options: {
    model: "claude-sonnet-5",
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
    console.log("\n\n---");
    console.log(`Cost:     $${message.total_cost_usd.toFixed(6)}`);
    console.log(`Duration: ${message.duration_ms}ms`);
  }
}
