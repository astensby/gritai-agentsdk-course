import type { NextConfig } from "next";

const config: NextConfig = {
  // The Agent SDK ships with optional native binaries and must run on the
  // Node.js server runtime, not the Edge runtime. App Router defaults to
  // Node for route handlers, so no extra config is needed — but we set it
  // explicitly in the route file itself for clarity.

  // Next.js 16.3+ writes `AGENTS.md` and `CLAUDE.md` into the project root the
  // first time `next dev` detects an AI coding agent, so the agent reads
  // version-matched docs instead of its training data. Genuinely useful on a
  // real project, but switched off here so this step stays predictable: it
  // would drop two untracked files into the folder, and a CLAUDE.md here
  // changes how your own Claude Code behaves while you work through the step.
  // Flip it to `true` to see the feature.
  agentRules: false,
};

export default config;
