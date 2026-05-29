# Step 5 — Interactive REPL

Everything from steps 1–4, but as a multi-turn chat in your terminal. This is "the workshop, in one shell."

## What's new vs step 4

- Multi-turn conversation (the agent remembers earlier turns)
- A small `agent.ts` that composes the full options (external MCP + custom MCP + skill); step 6 mirrors this same setup in its own folder
- The first `systemPrompt` in the course — the `claude_code` preset plus a one-line `append` to set the agent's persona (see `agent.ts`)
- Two patterns shown: **`resume`** (primary, simple) and **streaming-input** (advanced)

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-5
```

```
you > my name is Aleksander, what's the weather in Oslo?
agent > Hi Aleksander — Oslo is currently light snow, -3°C.

you > and what's my name?
agent > Aleksander.
```

The agent retains context across turns because we pass `resume: sessionId` from the second call onwards.

## How session continuity works

```ts
let sessionId: string | undefined;

while (true) {
  const input = await rl.question("you > ");

  const response = query({
    prompt: input,
    options: {
      ...baseOptions,
      ...(sessionId ? { resume: sessionId } : {}),   // ← rehydrates prior turns
    },
  });

  for await (const message of response) {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;                // ← capture on first turn
    }
    // ... handle assistant output
  }
}
```

On the first turn there's no session yet; the SDK creates one and emits its ID in the `system: init` message. From then on we pass `resume: sessionId` so the SDK rehydrates the full prior conversation from its session log.

## Advanced: streaming-input mode

```bash
npm run start:streaming
```

In `src/index-streaming.ts` we keep **one** `query()` call alive for the whole chat by feeding it an `AsyncIterable<SDKUserMessage>` instead of a single prompt string. Trade-offs:

|   | `resume` (default) | streaming-input |
|---|---|---|
| Number of `query()` calls | one per turn | one for the whole session |
| Mental model | request/response loop | single long-lived stream |
| Best fit | clearest for teaching, REPLs, HTTP request handlers | already async/streaming environments |

For step 6 (Next.js) we use the `resume` pattern because each HTTP request is naturally its own `query()` call.

## Try this

- Add `console.log(message)` inside the message loop and see every event the SDK emits. There's a lot more than `text`.
- Tell the agent "write me a poem to a file called poem.txt" — it'll use the filesystem MCP (it's wired up in `agent.ts`).
- Ask it to format a chunk of raw meeting notes — the skill from step 4 is loaded.

## Next

In [step 6](../step-6-web-chat) — a near-identical `agent.ts` (copied into that folder, not imported), but the UI is a web page instead of a terminal. The SDK code is the same; only the I/O differs.
