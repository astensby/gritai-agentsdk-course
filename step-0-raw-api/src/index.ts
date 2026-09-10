import Anthropic from "@anthropic-ai/sdk";

// Below the Agent SDK lives the raw Anthropic SDK: a thin HTTP client for
// the Claude REST API. There are no tools, no MCP, no skills here — just a
// single `messages.create()` call.
//
// Everything we learn in steps 1+ is built on top of this primitive. The
// Agent SDK runs a loop of these calls, threading tool results back in.

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-5",

  // `max_tokens` is a hard ceiling on the WHOLE response, and on current models
  // that includes the thinking tokens Claude generates before answering. Sonnet 5
  // thinks adaptively unless you say otherwise, so the ceiling is less
  // predictable than the visible answer length suggests.
  //
  // Measured on this exact prompt: Sonnet 4.6 produced 89 output tokens,
  // Sonnet 5 produced 174. Both finish comfortably inside a 1024 ceiling — but
  // the margin halved (~11x down to ~6x) without the prompt changing, and a
  // harder question thinks harder. Raising the ceiling costs nothing: you pay
  // for tokens produced, not for the ceiling.
  //
  // If you ever DO hit it, `stop_reason` below reads "max_tokens" instead of
  // "end_turn" and the answer stops mid-sentence. That's the tell.
  max_tokens: 4096,

  // Not required — but this is the cheapest lever you have on cost and latency,
  // so it's worth meeting on line 1 of the course. `effort` tunes how hard the
  // model works before answering: "low" | "medium" | "high" | "xhigh" | "max".
  // A three-sentence definition does not need deep reasoning.
  output_config: { effort: "low" },

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
