# Step 6 — Web Chat (bonus)

The same agent from step 5, behind a tiny Next.js web UI. The point: **the SDK doesn't change; only the I/O does.**

## What's new vs step 5

- A Next.js App Router app with one page and one API route
- The SDK runs in the route handler; the browser talks to it over **Server-Sent Events**
- `app/agent.ts` is essentially identical to step 5's `src/agent.ts` — same MCP servers, same skill, same options (including step 5's `cwd` + `disallowedTools` pair)
- `agentRules: false` in `next.config.ts` — Next 16.3+ writes `AGENTS.md`/`CLAUDE.md` into the project root on first `next dev`; switched off here so this step doesn't drop unexpected files into your folder

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-6
```

Open [http://localhost:3000](http://localhost:3000) and chat.

## Architecture

```
Browser  ──fetch /api/chat──▶  Next.js route (Node runtime)
                                  │
                                  ├─ query({ prompt, options: { ... resume } })
                                  ├─ for await stream → SSE
                                  ▼
                              [external MCP] [in-process MCP] [Skill]
```

- **`app/api/chat/route.ts`** — POST handler. Calls `query()` and translates the SDK message stream into SSE events for the browser.
- **`app/page.tsx`** — minimal React client that parses the SSE stream and renders the chat.
- **`app/agent.ts`** — the agent setup (mcpServers + allowedTools + settingSources + systemPrompt). **Mirrored from** step-5's `src/agent.ts`, not imported — each step folder is deliberately self-contained. Look at them side-by-side: it's the same code.

## Token-by-token streaming

The route uses `includePartialMessages: true` to opt into **token-level** streaming. Without it, the SDK only emits whole assistant messages — the UI would freeze for several seconds, then dump the full response. With it, the SDK emits `SDKPartialAssistantMessage` events containing raw Anthropic stream events; we forward the `content_block_delta` text deltas to the browser:

```ts
} else if (message.type === "stream_event") {
  const ev = message.event;
  if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
    send({ type: "text", text: ev.delta.text });
  }
}
```

The whole-message `assistant` and `result` events still arrive too, but with partials enabled we've already streamed the text from the deltas — so this minimal route ignores them. (A richer UI could read the `assistant` events' `tool_use` blocks to show which tools fired.)

## One Next.js-specific detail

```ts
export const runtime = "nodejs";        // ← required
export const dynamic = "force-dynamic"; // ← don't cache the stream
```

The Agent SDK uses Node APIs and ships with optional native binaries — it **cannot** run on the Edge runtime. App Router defaults to Node for route handlers, but we set it explicitly for clarity.

## Try this

- Open two browser tabs. They get independent sessions (each tab tracks its own `sessionId`).
- Wire up a "Reset" button that clears `sessionId` and starts a fresh conversation.
- Replace the SSE-by-hand code with the [Vercel AI SDK's](https://ai-sdk.dev) `useChat` hook — the Agent SDK output can be adapted into the AI SDK's `streamText` shape.
- Deploy to Vercel: `vercel deploy`. Add `ANTHROPIC_API_KEY` to the project env.

## That's it

You've now built six progressively-richer agents — from a 20-line one-shot prompt to a full web chat with custom tools, external tools, and a skill. The SDK pattern is the same throughout. Everything else is just I/O.

## Next

[Step 7 — Subagents](../step-7-subagents): one coordinator agent that delegates specialist work to subagents.
