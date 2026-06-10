#!/usr/bin/env node
/**
 * A minimal LOCAL MCP server — the thing the agent in ../src/index.ts points at.
 *
 * It exposes two tools over Norway's public police log ("Politiloggen") and
 * speaks the Model Context Protocol over STDIO. The Agent SDK launches this
 * file as a subprocess (via `tsx`) and talks to it on stdin/stdout — exactly
 * how step 2's filesystem server works, except here the server is ours.
 *
 * You never run this file directly; `npm run step-2c` spawns it for you.
 *
 * GOLDEN RULE of a stdio MCP server: stdout carries protocol traffic ONLY.
 * Any logging MUST go to stderr (console.error), or you corrupt the stream.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// 1. Create the server. The name/version are reported to the client during the
//    MCP handshake so the host knows what it's connected to.
const server = new McpServer({
  name: "police-incidents",
  version: "1.0.0",
});

const API_URL = "https://api.politiloggen.politiet.no/messages";

interface PoliceMessage {
  category: string;
  district: string;
  municipality: string;
  area: string;
  text: string;
  createdOn: string;
}

interface PoliceResponse {
  messages: PoliceMessage[];
  totalCount: number;
}

// Shared fetch + format helper. Returns an MCP tool result: a list of content
// blocks (here, one text block). On failure we return `isError: true` so the
// model sees the problem instead of getting a silent empty answer.
async function fetchIncidents(params: URLSearchParams) {
  let data: PoliceResponse;
  try {
    const res = await fetch(`${API_URL}?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Police API returned HTTP ${res.status}: ${await res.text()}`,
          },
        ],
      };
    }
    data = (await res.json()) as PoliceResponse;
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Failed to reach the police API: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ],
    };
  }

  if (data.messages.length === 0) {
    return { content: [{ type: "text" as const, text: "No incidents found." }] };
  }

  const lines = data.messages.map((m) => {
    const time = new Date(m.createdOn).toLocaleString("no-NO", {
      timeZone: "Europe/Oslo",
      dateStyle: "short",
      timeStyle: "short",
    });
    const place = [m.municipality, m.area].filter(Boolean).join(", ");
    return `• [${time}] ${m.category} — ${m.district}${place ? ` (${place})` : ""}\n  ${m.text}`;
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `${data.messages.length} incident(s) of ${data.totalCount} total:\n\n${lines.join("\n\n")}`,
      },
    ],
  };
}

// 2. Register the tools. The Zod input schema becomes the JSON Schema the model
//    sees and uses to decide how to call the tool.
server.registerTool(
  "latest_incidents",
  {
    title: "Latest police incidents",
    description:
      "Get the most recent incident messages from the Norwegian police log " +
      "(Politiloggen), newest first, across all of Norway.",
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("How many incidents to return. Defaults to 10, max 50."),
    },
  },
  // 3. The handler receives the validated input and returns a tool result.
  async ({ limit = 10 }) =>
    fetchIncidents(new URLSearchParams({ take: String(limit) })),
);

server.registerTool(
  "incidents_by_district",
  {
    title: "Police incidents by district",
    description:
      "Get the latest police incidents for a specific Norwegian police " +
      "district. Use this when the user names a place/region.",
    inputSchema: {
      district: z
        .string()
        .min(1)
        .describe(
          'Police district short name, e.g. "Oslo", "Øst", "Trøndelag", "Sør-Vest".',
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("How many incidents to return. Defaults to 10, max 50."),
    },
  },
  async ({ district, limit = 10 }) =>
    fetchIncidents(
      new URLSearchParams({ take: String(limit), Districts: district }),
    ),
);

// 4. Connect over stdio. The host launches this process and talks to it via
//    stdin/stdout. Note: logging goes to stderr — stdout is protocol-only.
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("police-incidents MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting police-incidents server:", error);
  process.exit(1);
});
