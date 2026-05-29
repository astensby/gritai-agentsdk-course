# Step 3 — Custom MCP Server (in-process)

Wrap your own TypeScript functions as MCP tools using the SDK's `createSdkMcpServer` helper. No subprocess, no JSON-RPC plumbing — just functions.

## What's new vs step 2

- `createSdkMcpServer` + `tool()` from the SDK
- zod schemas for tool inputs (the SDK converts them to JSON Schema for the model)
- An MCP server that lives **in the same process** as your agent

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-3
```

The agent will call `getWeather` then `getForecast`. You'll see each tool invocation in the trace.

## How it works

`src/weather-server.ts` defines two tools:

```ts
const getWeather = tool(
  "getWeather",                                        // ← name (shows up as mcp__weather__getWeather)
  "Get the current weather for a city. ...",           // ← description (the agent's decision lever)
  { city: z.string().describe("...") },                // ← inputSchema: ZOD RAW SHAPE (not z.object)
  async ({ city }) => ({                               // ← handler
    content: [{ type: "text", text: "..." }]
  })
);

export const weatherServer = createSdkMcpServer({
  name: "weather",
  version: "1.0.0",
  tools: [getWeather, getForecast],
});
```

Then in `src/index.ts` you mount it the same way as an external server:

```ts
mcpServers: { weather: weatherServer }
```

## The `tool()` gotcha

The third arg is a **zod raw shape** (`{ city: z.string() }`) — not a `z.object({ city: z.string() })`. The SDK wraps it for you. This trips up almost everyone the first time.

## In-process vs subprocess MCP — when to use which

| In-process (`createSdkMcpServer`) | Subprocess (stdio MCP) |
|---|---|
| Same TypeScript codebase | Reusable across projects/languages |
| Share state with your app | Process isolation |
| No marshaling overhead | Sandboxable |
| Can't reuse from non-SDK clients | Speaks plain MCP |

If you'd rather **build the MCP server itself** as a standalone, distributable artifact, see day 1's morning track on building MCP servers.

## Try this

- Improve the tool descriptions so the agent always passes a valid city. (Hint: add an enum or examples to the zod schema.)
- Add a third tool `getAirQuality(city)` and call it from the prompt.
- Make `getWeather` deliberately throw on `"Atlantis"`. Watch how the agent recovers.

## Next

The tool here returns **canned data** to keep the mechanics clear. In [step 3b](../step-3b-real-weather) the same tools call a **real weather API** — one small change to the handler. Then [step 4](../step-4-skills) gives the agent a **Skill** instead of a tool: a markdown file that teaches it *how* to do something well, with no code at all.
