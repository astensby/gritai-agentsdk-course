"use client";

import { useState, type FormEvent } from "react";

type Turn = { role: "user" | "agent"; text: string };

export default function Page() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setTurns((t) => [...t, { role: "user", text }, { role: "agent", text: "" }]);
    setInput("");
    setSending(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId }),
    });

    if (!res.body) {
      setSending(false);
      return;
    }

    // Parse the SSE stream: lines starting with "data: " carry JSON payloads.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = JSON.parse(line.slice(6));

        if (payload.type === "session") {
          setSessionId(payload.sessionId);
        } else if (payload.type === "text") {
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = {
              role: "agent",
              text: copy[copy.length - 1].text + payload.text,
            };
            return copy;
          });
        } else if (payload.type === "error") {
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = {
              role: "agent",
              text: `⚠️ ${payload.message}`,
            };
            return copy;
          });
        }
      }
    }

    setSending(false);
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minHeight: "100vh",
      }}
    >
      <header style={{ borderBottom: "1px solid #1f242a", paddingBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          Workshop Agent
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#7d8590" }}>
          Step 6 — same agent setup as step 5, web UI instead of terminal.
        </p>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        {turns.length === 0 && (
          <p style={{ color: "#7d8590", fontSize: 14 }}>
            Try: <em>"What's the weather in Oslo?"</em> or paste some meeting
            notes and ask for them to be formatted.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: t.role === "user" ? "#1a2330" : "#11161c",
              border: "1px solid #1f242a",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#7d8590",
                marginBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {t.role}
            </div>
            {t.text || (t.role === "agent" && sending ? "…" : "")}
          </div>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        style={{ display: "flex", gap: 8, paddingTop: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={sending}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#0f141a",
            border: "1px solid #1f242a",
            color: "#e7eaee",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: sending ? "#1f242a" : "#3b82f6",
            color: "#fff",
            border: "none",
            fontSize: 14,
            cursor: sending ? "default" : "pointer",
          }}
        >
          Send
        </button>
      </form>
    </main>
  );
}
