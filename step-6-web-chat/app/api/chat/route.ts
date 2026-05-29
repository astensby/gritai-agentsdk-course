import { query } from "@anthropic-ai/claude-agent-sdk";
import { buildAgentOptions } from "../../agent";

// Force Node.js runtime — the Agent SDK uses Node APIs (child_process for
// MCP stdio servers, native bindings) and cannot run on the Edge runtime.
export const runtime = "nodejs";

// Disable Vercel response caching for the streamed response.
export const dynamic = "force-dynamic";

type ChatRequest = {
  message: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;

  const baseOptions = buildAgentOptions();
  const response = query({
    prompt: body.message,
    options: {
      ...baseOptions,
      // Stream tokens (not just whole messages). The SDK emits
      // SDKPartialAssistantMessage events containing raw Anthropic
      // content_block_delta events.
      includePartialMessages: true,
      ...(body.sessionId ? { resume: body.sessionId } : {}),
    },
  });

  // Stream Server-Sent Events back to the browser.
  // Each event is a JSON object the client can parse and render incrementally.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      // The agent can emit several text blocks per reply (e.g. a line before a
      // tool call, then the answer after). They arrive as separate blocks, so
      // we insert a paragraph break between them — otherwise the client, which
      // just concatenates deltas, would run them together ("…weather.It's…").
      let hasStreamedText = false;

      try {
        for await (const message of response) {
          if (message.type === "system" && message.subtype === "init") {
            send({ type: "session", sessionId: message.session_id });
          } else if (message.type === "stream_event") {
            // Token-by-token streaming. `event` is the raw Anthropic stream-event
            // union (`BetaRawMessageStreamEvent`) — TS narrows it for us based on
            // the `type` discriminant. We only forward text deltas and a paragraph
            // break between consecutive text blocks.
            const ev = message.event;
            if (
              ev.type === "content_block_start" &&
              ev.content_block.type === "text" &&
              hasStreamedText
            ) {
              send({ type: "text", text: "\n\n" });
            } else if (
              ev.type === "content_block_delta" &&
              ev.delta.type === "text_delta"
            ) {
              hasStreamedText = true;
              send({ type: "text", text: ev.delta.text });
            }
          }
          // Whole-message `assistant` and `result` events still arrive, but
          // with partials enabled we've already streamed the text from the
          // deltas — and this minimal client only renders text — so we ignore
          // them. (A richer UI could read `assistant` tool_use blocks here to
          // show "used tool: X" chips.)
        }
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
