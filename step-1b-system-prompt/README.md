# Step 1b — The system prompt

Same prompt, same model, run once per way of setting `systemPrompt`. You'll see which ways replace Claude Code's prompt and which keep it, and what each one costs in input tokens.

The job is the one from the slides: turn merged PRs into a Keep-a-Changelog entry.

```ts
const changelog = `You turn merged PRs into a Keep-a-Changelog entry.
Group under Added, Changed, Fixed. One line each.
Markdown under a ## [unreleased] heading.
Never invent a change absent from the diff.`;
```

## What you'll learn

- A **string** `systemPrompt` **replaces** the default. You own every word.
- `{ type: "preset", preset: "claude_code", append }` **keeps** Claude Code's prompt and adds yours at the end.
- Leaving `systemPrompt` out does **not** give you Claude Code's prompt. The SDK sends a minimal default.
- A `string[]` prompt can mark a cache boundary with `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`, which separates the static part from the per-session part.
- `excludeDynamicSections: true` makes the preset identical for every user, so many users can share one cached prompt.

## Run it

```bash
npm run step-1b              # all six variants, one after another (a few cents)
npm run step-1b -- append    # just one: omitted | string | preset | append | blocks | fleet
```

## The six variants

| Name | `systemPrompt` | What the agent gets |
|---|---|---|
| `omitted` | *(not set)* | The SDK's minimal default. Not Claude Code's prompt, and none of your rules. |
| `string` | `changelog` | Your text as the whole system prompt. **Replaces** the default. *(The highlighted line on the slide.)* |
| `preset` | `{ type: "preset", preset: "claude_code" }` | Claude Code's full prompt: tone, safety, tool-use rules. Nothing about changelogs. |
| `append` | `{ type: "preset", preset: "claude_code", append: changelog }` | Claude Code's prompt **plus** yours. *(The commented-out line on the slide.)* |
| `blocks` | `[changelog, SYSTEM_PROMPT_DYNAMIC_BOUNDARY, sessionContext]` | Your text, split into a part that can be cached across sessions and a per-session part. |
| `fleet` | `{ ...append, excludeDynamicSections: true }` | Same as `append`, but working dir, git status and memory path move to the first user message. |

## What a run looks like

Measured on 18 November 2026 with `claude-sonnet-5-5`, `tools: []` and auto-memory off. Your wording will differ; the shape won't. The counts include the user prompt and about 370 tokens of context the SDK always adds to the first message, so even a one-word system prompt starts around 400.

| Variant | Heading it wrote | Input tokens |
|---|---|---|
| `omitted` | `## Changelog`, bold multi-sentence entries | ~560 |
| `string` | `## [unreleased]`, one line each | ~640 |
| `preset` | `## Changelog`, bold multi-sentence entries | ~2,160 |
| `append` | `## [unreleased]`, one line each | ~2,250 |
| `blocks` | `## [unreleased]`, one line each | ~670 |
| `fleet` | `## [unreleased]`, one line each | ~2,200 |

Two things to read off it:

1. **Your rules only apply where you put them.** `omitted` and `preset` write a perfectly good changelog, just not *yours*. The `## [unreleased]` heading is the tell.
2. **The preset costs about 1,600 tokens on every request**, before you've said anything. That's with `tools: []`. With Claude Code's default tools enabled, their definitions add more than 10,000 tokens on top. That's worth paying when you want Claude Code's behaviour (file editing, Bash etiquette, safety rules), and wasted when you're building a single-purpose agent like this one.

**An honest note on the last rule.** PR #482 is titled "Fix date picker and improve performance", but its diff only fixes the date picker. In our runs, Sonnet 5.5 left "performance" out in *every* variant, including the ones without "Never invent a change". So the rule is a guard for weaker models and messier diffs, not something this demo can prove.

## When to use which

- **Single-purpose agent** (changelog writer, classifier, extractor): a **string**. It's small, cheap, and does exactly what you wrote.
- **Coding agent that edits files and runs commands:** **preset + `append`**. You get Claude Code's tool-use rules for free. Steps 5 and 6 do this.
- **Many users, same agent:** add `excludeDynamicSections: true` to the preset, or use a `string[]` with the boundary, so the cacheable part is identical for everyone.
- **Somewhere in between:** `{ type: "custom", prompt }` is the object form of a string prompt. You need it only to set `snapshot` (below).

## Gotchas

1. **A session keeps the system prompt it started with.** The prompt is recorded on the first request and reused on every `resume`/`continue`, so a different `append` on a later launch of the same session is ignored until compaction. That's why each variant here is a fresh `query()`. When you're iterating on prompt text across resumes, pass `snapshot: false`. The SDK docs say recording is still rolling out, so you may not see this yet. Set the option anyway; it's safe.
2. **`settingSources: []` matters here.** Without it, `CLAUDE.md` and your own Claude Code settings load too, and the comparison is no longer like-for-like. Step 4 shows the other side: `settingSources: ["project"]` is how project instructions and skills get in.
3. **`settingSources: []` doesn't turn off auto-memory.** If you've used Claude Code in this folder, it keeps notes under `~/.claude/projects/<folder>/memory/`, and the agent loads that `MEMORY.md` on every request. The preset also adds instructions for using it. This step sets `settings: { autoMemoryEnabled: false }` so your numbers match everyone else's.
4. **`excludeDynamicSections` only affects the preset.** It does nothing with a string prompt, which has no dynamic sections to strip.

## Try this

- Delete `One line each.` from `changelog` and rerun `string`. Watch the entries grow.
- Add `"Write in Norwegian."` to the `blocks` session context (after the boundary) and rerun `blocks`. Per-session instructions work, but they don't share the cache.
- Take `tools: []` out and rerun `preset`. The input-token count jumps by more than 10,000: that's the tool definitions.

## Key concepts

| Concept | Where in code |
|---|---|
| Replace the prompt | `systemPrompt: changelog` |
| Extend Claude Code's prompt | `systemPrompt: { type: "preset", preset: "claude_code", append }` |
| Cache boundary | `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` in a `string[]` |
| Cross-user caching | `excludeDynamicSections: true` |
| Measuring prompt size | `result.usage`: `input_tokens + cache_read_input_tokens + cache_creation_input_tokens` |
