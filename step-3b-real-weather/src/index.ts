import { query } from "@anthropic-ai/claude-agent-sdk";
import { weatherServer } from "./weather-server.ts";

// Same setup as step 3 — same `tool()` definitions, same mounting, same
// allowlist. The ONLY difference is that the tool handlers in
// `weather-server.ts` now call a real weather API instead of returning canned
// data. The agent doesn't know or care: a tool is a tool.

const response = query({
  prompt:
    "What's the weather in Oslo right now? Also give me a 3-day forecast for San Francisco.",
  options: {
    model: "claude-sonnet-5",

    // Mount our in-process MCP server. The key ("weather") becomes the tool prefix.
    mcpServers: {
      weather: weatherServer,
    },

    // Whitelist — same rules as step 2.
    allowedTools: [
      "mcp__weather__getWeather",
      "mcp__weather__getForecast",
    ],
  },
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      } else if (block.type === "tool_use") {
        console.log(`\n[tool call] ${block.name}(${JSON.stringify(block.input)})`);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
  }
}
