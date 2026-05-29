// Same shape as step-5's agent.ts. The SDK call is identical — only the I/O
// changes between a terminal REPL (step 5) and an HTTP+SSE route (this step).

import path from "node:path";
import {
  createSdkMcpServer,
  tool,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// The weather tool calls the free, no-API-key Open-Meteo service (same as
// step 5). WMO weather codes → short description (https://open-meteo.com/en/docs).
const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Heavy freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

const weatherServer = createSdkMcpServer({
  name: "weather",
  version: "1.0.0",
  tools: [
    tool(
      "getWeather",
      "Get the current weather for a city. Returns description + temp in °C.",
      { city: z.string().describe("City name, e.g. 'Oslo'.") },
      async ({ city }) => {
        const geo = (await (await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
        )).json()) as { results?: { name: string; country: string; latitude: number; longitude: number }[] };
        const place = geo.results?.[0];
        if (!place) return { content: [{ type: "text", text: `Couldn't find "${city}".` }] };
        const wx = (await (await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`
        )).json()) as { current?: { temperature_2m: number; weather_code: number } };
        const c = wx.current;
        if (!c) return { content: [{ type: "text", text: `No weather available for ${place.name}.` }] };
        const desc = WEATHER_CODES[c.weather_code] ?? "Unknown conditions";
        return {
          content: [
            { type: "text", text: `${place.name}, ${place.country}: ${desc}, ${Math.round(c.temperature_2m)}°C` },
          ],
        };
      }
    ),
  ],
});

export function buildAgentOptions(): Options {
  // Step 5 uses `import.meta.url` to anchor the sandbox to the source file. In
  // Next.js, source files are bundled and `import.meta.url` doesn't point at
  // your project — but `process.cwd()` reliably points at the Next.js project
  // root (where `next dev` ran), which is what we want here.
  const sandboxDir = path.resolve(process.cwd(), "sandbox");
  return {
    model: "claude-sonnet-4-6",
    // Scope skill discovery to this project (see step 4).
    settingSources: ["project"],
    mcpServers: {
      fs: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", sandboxDir],
      },
      weather: weatherServer,
    },
    allowedTools: [
      "mcp__fs__read_text_file",
      "mcp__fs__read_file",
      "mcp__fs__write_file",
      "mcp__fs__list_directory",
      "mcp__weather__getWeather",
    ],
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append:
        "You are the workshop web-chat agent. Keep replies short and conversational.",
    },
  };
}
