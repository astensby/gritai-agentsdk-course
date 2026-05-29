import { query } from "@anthropic-ai/claude-agent-sdk";
import { weatherServer } from "./weather-server.ts";

const response = query({
  prompt:
    "What's the weather in Oslo right now? Also give me a 3-day forecast for San Francisco.",
  options: {
    model: "claude-sonnet-4-6",

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
