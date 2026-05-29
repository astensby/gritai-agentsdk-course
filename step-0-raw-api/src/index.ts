import Anthropic from "@anthropic-ai/sdk";

// Below the Agent SDK lives the raw Anthropic SDK: a thin HTTP client for
// the Claude REST API. There are no tools, no MCP, no skills here — just a
// single `messages.create()` call.
//
// Everything we learn in steps 1+ is built on top of this primitive. The
// Agent SDK runs a loop of these calls, threading tool results back in.

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Explain what an AI agent is in three sentences." },
  ],
});

for (const block of response.content) {
  if (block.type === "text") {
    process.stdout.write(block.text);
  }
}

console.log("\n\n---");
console.log(`Input tokens:  ${response.usage.input_tokens}`);
console.log(`Output tokens: ${response.usage.output_tokens}`);
console.log(`Stop reason:   ${response.stop_reason}`);
