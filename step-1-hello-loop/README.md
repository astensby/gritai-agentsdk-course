# Step 1 — Hello Loop

The smallest possible Claude Agent SDK program. One prompt, one response.

## What you'll learn

- The Agent SDK's core API: `query({ prompt, options })`
- That `query()` returns an **async iterable of messages** — there is no separate "agent loop" to write
- The shape of the message stream: `system`, `assistant`, `result`

## Run it

```bash
# from the repo root (one-time setup is in the main README)
npm run step-1
```

You should see Claude's answer stream to stdout, followed by cost + duration:

```
An AI agent is software that ...
---
Cost:     $0.001234
Duration: 1842ms
```

## Try this

- Swap the model to `claude-haiku-4-5` (faster, cheaper) or `claude-opus-4-7` (smarter, costlier) and observe the cost change.
- Change the prompt to something requiring tools — like `"Read package.json and tell me the dependencies."` — and watch it fail. Why? You haven't given it any tools yet. That's [step 2](../step-2-external-mcp).

## Key concepts

| Concept | Where in code |
|---|---|
| Async iterable | `for await (const message of response)` |
| Message types | `message.type === "assistant" \| "result" \| ...` |
| Content blocks | `message.message.content` is an array of typed blocks — here always `text`; `tool_use` blocks appear once you add tools (step 2) |
| Cost telemetry | `message.total_cost_usd` on `result` messages |
