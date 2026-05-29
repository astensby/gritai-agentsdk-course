import readline from "node:readline/promises";
import {
  query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { buildAgentOptions } from "./agent.ts";

// ADVANCED VARIANT — Streaming-input mode.
//
// Instead of calling query() per user turn with `resume`, we hand the SDK
// an AsyncIterable<SDKUserMessage> as the prompt. The SDK keeps a single
// session open and pulls messages from the iterable as they arrive.
//
// Trade-offs vs ./index.ts:
//   + Single connection, no per-turn session rehydration
//   + Natural fit if you're already plumbing async streams (web servers, etc.)
//   - Slightly more conceptual overhead — you're juggling two async generators
//
// Run with: npm run start:streaming

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function* userInputs(): AsyncGenerator<SDKUserMessage> {
  console.log("Workshop agent (streaming mode). Type /exit to quit.\n");
  while (true) {
    const input = (await rl.question("you > ")).trim();
    if (input === "/exit" || input === "") return;
    process.stdout.write("agent > ");
    yield {
      type: "user",
      message: { role: "user", content: input },
      parent_tool_use_id: null,
    };
  }
}

const response = query({
  prompt: userInputs(),
  options: buildAgentOptions(),
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      }
    }
  } else if (message.type === "result") {
    // Each turn still produces its own `result` event — same event shape as
    // the `resume`-based variant. The only structural difference between the
    // two variants is that we keep ONE query() alive across all turns here,
    // whereas the resume variant calls query() once per turn.
    process.stdout.write("\n\n");
  }
}

rl.close();
