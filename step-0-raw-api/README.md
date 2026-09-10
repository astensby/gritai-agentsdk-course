# Step 0 — Raw API (before the Agent SDK)

What's below the Agent SDK? This.

## What you'll learn

- The raw [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) — a thin HTTP client for Claude's REST API
- A single `messages.create()` call: prompt in, response out, done
- Why the Agent SDK exists: it wraps a *loop* of these calls and threads tool results back in

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-0
```

You'll see the response, then token counts and a stop reason.

## The core call

(The full file also has the loop that prints the response and token counts — this is the part that matters.)

```ts
const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-5",
  max_tokens: 4096,
  output_config: { effort: "low" },
  messages: [
    { role: "user", content: "Explain what an AI agent is in three sentences." },
  ],
});
```

That's it. One HTTP call. One response.

## How the Agent SDK relates

The Agent SDK is **not a different API**. It's a runtime that:

1. Calls `messages.create()` like above
2. Looks at the response — did the model ask to use a tool?
3. If yes: runs the tool, appends the result to the conversation, and calls `messages.create()` again
4. Repeats until the model says "I'm done" (`stop_reason: "end_turn"`)
5. Plus: MCP plumbing, skill discovery, hooks, permissions, sessions, ...

You could write the loop yourself with raw `messages.create()` calls — and people do, when they need full control. The Agent SDK is the well-tested, conventions-baked-in version.

## Next

[Step 1](../step-1-hello-loop) — the same idea, but via the Agent SDK. You'll see the *exact same model + prompt* return through a different API, with the loop already built for you.
