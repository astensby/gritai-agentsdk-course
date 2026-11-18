import {
  query,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";

// Step 1b — the system prompt, set in code.
//
// Same user prompt, same model, run once per way of setting `systemPrompt`.
// Each run is a fresh `query()` (no `resume`): a session records its system
// prompt on the first request, so changing it mid-session would be ignored.
//
//   npm run step-1b              # all variants, one after another
//   npm run step-1b -- append    # just one (names are listed below)

// The instructions we want the agent to follow. A real job, with rules you can
// check in the output: Keep-a-Changelog format, an `## [unreleased]` heading,
// one line per change, and nothing that isn't in the PRs.
const changelog = `You turn merged PRs into a Keep-a-Changelog entry.
Group under Added, Changed, Fixed. One line each.
Markdown under a ## [unreleased] heading.
Never invent a change absent from the diff.`;

// The agent has no tools in this step, so the PRs travel in the prompt.
// PR 482 tests the last rule: its title promises more than its diff delivers.
const prompt = `Write the entry for PRs 479, 481 and 482.

#479 "Add CSV export to the reports page"
  diff: new ExportCsvButton component; GET /api/reports/:id/export.csv

#481 "Bump session timeout from 30 to 60 minutes"
  diff: SESSION_TTL_MINUTES = 30 -> 60 in config/auth.ts

#482 "Fix date picker and improve performance"
  diff: DatePicker now parses dates as UTC instead of local time (fixes off-by-one day).
        No other files changed.`;

// Every way of passing `systemPrompt`. Only that field differs between them.
const variants: Record<string, { what: string; systemPrompt?: Options["systemPrompt"] }> = {
  // 1. Leave it out. The agent gets the SDK's minimal default prompt: no
  //    Claude Code persona, and none of our rules.
  omitted: {
    what: "systemPrompt omitted (SDK default)",
  },

  // 2. A plain string REPLACES the default entirely. This is the line on the
  //    slide. You own every word the model is told.
  string: {
    what: "systemPrompt: changelog  (replaces the default)",
    systemPrompt: changelog,
  },

  // 3. Claude Code's own system prompt, unchanged. Its rules about tone,
  //    safety and tool use, but nothing about changelogs.
  preset: {
    what: '{ type: "preset", preset: "claude_code" }',
    systemPrompt: { type: "preset", preset: "claude_code" },
  },

  // 4. Claude Code's prompt PLUS ours, appended at the end. The commented-out
  //    line on the slide. Use this when you still want Claude Code's behaviour
  //    (tools, safety, coding conventions) and only need to add a job.
  append: {
    what: '{ type: "preset", preset: "claude_code", append: changelog }',
    systemPrompt: { type: "preset", preset: "claude_code", append: changelog },
  },

  // 5. A custom prompt as an array of blocks. Everything before
  //    SYSTEM_PROMPT_DYNAMIC_BOUNDARY is the same for every user and can be
  //    prompt-cached across sessions; everything after it is per-session.
  //    Put stable instructions first and request-specific context last.
  blocks: {
    what: "[changelog, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, sessionContext]",
    systemPrompt: [
      changelog,
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      `Repository: acme/web. Release manager: Kari. Today: ${new Date().toISOString().slice(0, 10)}.`,
    ],
  },

  // 6. The preset, with its per-user sections (working directory, git status,
  //    memory path) moved out of the system prompt into the first user
  //    message, so many users can share one cached prompt. Same answer as
  //    `append`; the difference is in caching, not in behaviour.
  fleet: {
    what: '{ type: "preset", preset: "claude_code", append: changelog, excludeDynamicSections: true }',
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: changelog,
      excludeDynamicSections: true,
    },
  },
};

const only = process.argv[2];
if (only && !(only in variants)) {
  console.error(`Unknown variant "${only}". Pick one of: ${Object.keys(variants).join(", ")}`);
  process.exit(1);
}

for (const [name, variant] of Object.entries(variants)) {
  if (only && name !== only) continue;

  console.log(`\n${"=".repeat(72)}\n${name}: ${variant.what}\n${"=".repeat(72)}`);

  const response = query({
    prompt,
    options: {
      model: "claude-sonnet-5-5",
      systemPrompt: variant.systemPrompt,
      // No tools, so the token counts below compare system prompts and not
      // tool definitions, and the agent can't go looking for a real repo.
      tools: [],
      // Don't inherit this machine's Claude Code settings or CLAUDE.md, so
      // every variant (and every laptop) starts from the same place.
      settingSources: [],
      // ...and don't load Claude Code's auto-memory for this folder either.
      // `settingSources: []` doesn't cover it: if you've used Claude Code in
      // this repo, its MEMORY.md would otherwise ride along on every request.
      settings: { autoMemoryEnabled: false },
    },
  });

  for await (const message of response) {
    if (message.type === "result") {
      if (message.subtype === "success") console.log(message.result);
      else console.log(`(no answer: ${message.subtype})`);

      // Everything the model read before answering: system prompt + our
      // prompt. Cached or not, it all counts towards the context window, so
      // add the three together. (Cost swings run to run with the cache;
      // this number doesn't.)
      const u = message.usage;
      const inputTokens =
        u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
      console.log(
        `\n--- input tokens: ${inputTokens}  ·  cost: $${message.total_cost_usd.toFixed(4)}`,
      );
    }
  }
}
