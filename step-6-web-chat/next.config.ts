import type { NextConfig } from "next";

const config: NextConfig = {
  // The Agent SDK ships with optional native binaries and must run on the
  // Node.js server runtime, not the Edge runtime. App Router defaults to
  // Node for route handlers, so no extra config is needed — but we set it
  // explicitly in the route file itself for clarity.
};

export default config;
