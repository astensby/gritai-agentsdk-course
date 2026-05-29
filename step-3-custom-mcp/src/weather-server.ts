import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// PLACEHOLDER DATA. This step is about the *mechanics* of defining a tool —
// `tool()`, the zod raw shape, `createSdkMcpServer` — so the handlers just
// return canned values and stay dead simple. (That's why "Oslo" is always
// snowy here: it's a stub, not a real forecast.) In the next step,
// `step-3b-real-weather`, these exact same tools call a real weather API.
const fakeWeather: Record<string, { description: string; tempC: number }> = {
  Oslo: { description: "Light snow", tempC: -3 },
  "San Francisco": { description: "Foggy", tempC: 14 },
  London: { description: "Rainy", tempC: 9 },
  Tokyo: { description: "Clear skies", tempC: 18 },
};

// `tool(name, description, inputSchema, handler)`
//
// - `name`: what the model sees, and what you whitelist via `allowedTools`.
// - `description`: the agent reads this to decide WHEN to call the tool.
//   Write it well — this is the single biggest lever on tool-use quality.
// - `inputSchema`: a zod RAW SHAPE (a plain object of zod fields).
//   Note: NOT `z.object({...})` — the SDK calls z.object() for you.
// - `handler`: an async function that returns `{ content: [...] }`.
const getWeather = tool(
  "getWeather",
  "Get the current weather for a city. Returns a one-line description and temperature in Celsius.",
  {
    city: z.string().describe("City name, e.g. 'Oslo' or 'San Francisco'."),
  },
  async ({ city }) => {
    const w = fakeWeather[city] ?? { description: "Sunny", tempC: 22 };
    return {
      content: [
        { type: "text", text: `${city}: ${w.description}, ${w.tempC}°C` },
      ],
    };
  }
);

const getForecast = tool(
  "getForecast",
  "Get a multi-day weather forecast for a city.",
  {
    city: z.string().describe("City name."),
    days: z.number().int().min(1).max(7).describe("Forecast horizon, 1-7 days."),
  },
  async ({ city, days }) => {
    const lines = Array.from(
      { length: days },
      (_, i) => `  Day ${i + 1}: Partly cloudy, 20°C`
    ).join("\n");
    return {
      content: [
        { type: "text", text: `Forecast for ${city}:\n${lines}` },
      ],
    };
  }
);

// An "SDK MCP server" is just a bundle of tools the SDK exposes IN-PROCESS
// (no subprocess, no stdio) via the MCP protocol. You consume it the same
// way as an external server.
export const weatherServer = createSdkMcpServer({
  name: "weather",
  version: "1.0.0",
  tools: [getWeather, getForecast],
});
