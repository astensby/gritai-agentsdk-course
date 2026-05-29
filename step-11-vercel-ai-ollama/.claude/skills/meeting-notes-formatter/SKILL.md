---
name: meeting-notes-formatter
description: Use this skill when the user provides raw meeting notes, transcript snippets, or stream-of-consciousness notes from a discussion and wants them organized. Transforms messy notes into a structured summary with Decisions, Action Items, and Open Questions sections.
---

# Meeting Notes Formatter

When invoked, transform the raw meeting notes into output that follows EXACTLY this template:

## Summary
A 1–2 sentence overview of what the meeting was about.

## Decisions
- One bullet per decision made.

## Action Items
- [ ] **@owner** — Action description (due: date if mentioned)

## Open Questions
- Each unresolved question on its own line.

Rules: do not invent items not in the source; preserve names verbatim; if a section is empty write `_None._`.
