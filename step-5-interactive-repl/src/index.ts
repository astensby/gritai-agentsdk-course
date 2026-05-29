import readline from "node:readline/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildAgentOptions } from "./agent.ts";

// Multi-turn chat in the terminal.
//
// Approach: call query() once per user message, passing `resume: sessionId`
// from the second turn onwards. The SDK rehydrates the prior conversation
// from its session log so the agent has full context.
//
// This is the clearest pattern for teaching. For a more advanced pattern
// that keeps a single Query alive across turns (better for some streaming
// scenarios), see ./index-streaming.ts.

const baseOptions = buildAgentOptions();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let sessionId: string | undefined;
console.log("Workshop agent. Type /exit (or an empty line) to quit.\n");

while (true) {
  const input = (await rl.question("you > ")).trim();
  if (input === "/exit" || input === "") break;

  process.stdout.write("agent > ");

  const response = query({
    prompt: input,
    options: {
      ...baseOptions,
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });

  for await (const message of response) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
    } else if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    }
  }

  process.stdout.write("\n\n");
}

rl.close();
