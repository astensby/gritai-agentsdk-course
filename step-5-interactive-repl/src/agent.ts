// The agent setup for step 5 (terminal REPL). Step 6 (web chat) carries a
// near-identical copy in its own app/agent.ts — same SDK call, only the I/O
// surface differs (stdin/stdout here vs HTTP/SSE there). Each step folder is
// deliberately self-contained, so the file is copied, not imported.

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSdkMcpServer,
  tool,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// --- A small custom MCP server (carried from step 3) -----------------------
// It calls the free, no-API-key Open-Meteo service — a custom tool can wrap a
// real HTTP API just as easily as canned data.

// WMO weather codes → short description (https://open-meteo.com/en/docs).
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

// --- Compose the full options object ---------------------------------------

export function buildAgentOptions(): Options {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sandboxDir = path.resolve(__dirname, "..", "sandbox");

  return {
    model: "claude-sonnet-5",

    // Run the session INSIDE the sandbox. Two reasons:
    //  1. The filesystem MCP server below speaks the MCP "roots" protocol: on
    //     connect it asks us for our roots and replaces its allowed directories
    //     with whatever we answer. Our root is this `cwd`. Without this line the
    //     server's own command-line argument is overridden and the agent can
    //     read and write the whole step folder — including its own source.
    //  2. Skill discovery still works: the engine walks UP from `cwd` to find
    //     the project root, so `.claude/skills/` one level above is still found.
    cwd: sandboxDir,

    // Scope skill discovery to this project (see step 4).
    settingSources: ["project"],

    // External MCP (from step 2) + in-process MCP (from step 3).
    mcpServers: {
      fs: {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem@2026.8.31", sandboxDir],
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

    // Without this, "save that to a file" quietly fails. The built-in Write/Edit
    // tools are always in the model's toolbox and it prefers them for file work;
    // they are NOT in `allowedTools`, and in a headless session an unapproved
    // tool is simply denied — so the agent apologises instead of writing. Taking
    // the built-ins away leaves the MCP server as the only route, which is the
    // one this step is teaching. (Step 2b is the mirror image: built-ins only.)
    disallowedTools: ["Write", "Edit", "NotebookEdit"],

    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append:
        "You are the workshop demo agent. Keep replies short and conversational unless asked otherwise. " +
        "For any file operation, use the mcp__fs__* tools — they are scoped to your sandbox directory.",
    },
  };
}
