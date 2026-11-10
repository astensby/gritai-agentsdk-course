import path from "node:path";
import { fileURLToPath } from "node:url";
import { streamText, stepCountIs, tool } from "ai";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioTransport } from "@ai-sdk/mcp/mcp-stdio";
import { ollama } from "ollama-ai-provider-v2";
import { z } from "zod";
import { loadSkills, formatSkillsAsSystemBlock } from "./skills.ts";

// ALTERNATIVE-SDK DEMO
//
// Same agent ideas (MCP + skills + custom tools) — different SDK, different
// model provider. We use the Vercel AI SDK v7 with Ollama instead of the
// Claude Agent SDK with Anthropic.
//
// What stays the same:
//   - There's a system prompt
//   - There are tools (custom + MCP)
//   - There's a loop (tool call → tool result → next step)
//
// What's different:
//   - `streamText` instead of `query`
//   - `stopWhen: stepCountIs(N)` instead of automatic loop
//   - Skills are NOT a first-class feature — we load + inject manually
//   - Tool quality is bounded by the local model (see README)
//
// Requires Ollama running locally: `ollama serve` + a tool-capable model.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const sandboxDir = path.join(projectDir, "sandbox");
const skillsDir = path.join(projectDir, ".claude", "skills");

const MODEL = process.env.OLLAMA_MODEL ?? "llama3.3";

const rawNotes = `
Q3 LAUNCH SYNC — 12 May 2026
Attendees: Anna (eng), Bob (marketing), Chen (security), Dani (PM)

Decided to push the launch from June 15 to June 30 to make room for security review.
Anna will lead the security review and coordinate with Chen's team.
Bob to draft revised launch comms by next Friday.
Anna to share security-review checklist on Monday.

Open: do we owe customers a heads-up before June 15? Bob to consult legal.
Open: budget for a second push if the date slips? Dani to ask the CFO.
`;

// 1) Load skills the same way the Claude Agent SDK does — from .claude/skills/
const skills = await loadSkills(skillsDir);
console.log(`Loaded ${skills.length} skill(s) from .claude/skills/`);

// 2) Wire up an MCP server (filesystem, same one as steps 2/5/6)
const mcpClient = await createMCPClient({
  transport: new StdioTransport({
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@2.1.0", sandboxDir],
  }),
});
const mcpTools = await mcpClient.tools();

// WMO weather codes → short description (https://open-meteo.com/en/docs).
const WEATHER_CODES: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "heavy freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
  80: "light showers", 81: "showers", 82: "violent showers", 85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm",
};

// 3) Define a custom tool (same idea as step-3's weather tool) — it calls the
//    free, no-API-key Open-Meteo service, just like the Claude steps do.
const weatherTool = tool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. 'Oslo'"),
  }),
  execute: async ({ city }) => {
    const geo = (await (await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    )).json()) as { results?: { name: string; latitude: number; longitude: number }[] };
    const place = geo.results?.[0];
    if (!place) return `Couldn't find "${city}".`;
    const wx = (await (await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`
    )).json()) as { current?: { temperature_2m: number; weather_code: number } };
    const c = wx.current;
    if (!c) return `No weather available for ${place.name}.`;
    return `${place.name}: ${WEATHER_CODES[c.weather_code] ?? "unknown"}, ${Math.round(c.temperature_2m)}°C`;
  },
});

// 4) Run the agent loop
const result = streamText({
  model: ollama(MODEL),
  system: `You are a helpful agent. Use the available tools and skills as needed.${formatSkillsAsSystemBlock(skills)}`,
  prompt: `Format these raw meeting notes into a structured summary using the meeting-notes-formatter skill, then save the result to formatted.md in your sandbox using the filesystem tools.

RAW NOTES:
${rawNotes}`,
  tools: {
    weather: weatherTool,
    ...mcpTools,
  },
  // `stopWhen` is the equivalent of an "agent loop" — keep calling the model
  // after every tool result until it stops requesting tools, OR we hit N steps.
  stopWhen: stepCountIs(8),
  onFinish: async () => {
    await mcpClient.close();
  },
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}

console.log("\n\n---");
console.log(`Model:  ${MODEL}`);
console.log(`Output: ${sandboxDir}/formatted.md (if the model used the tool)`);
