import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";

// A tiny "skill loader" that mimics the Claude Agent SDK's .claude/skills/
// discovery convention. The Vercel AI SDK doesn't ship a skill system, so
// we roll our own in a few dozen lines:
//
//   1. Read every SKILL.md under .claude/skills/<name>/
//   2. Parse YAML frontmatter (gray-matter)
//   3. Concatenate name + description + body into one chunk of system prompt
//
// The model sees: "you have these skills, here's when to use each."
// Whether it actually USES them depends on the model. Small Ollama models
// often need an explicit nudge in the prompt; Claude doesn't.

export type Skill = {
  name: string;
  description: string;
  body: string;
};

export async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    // No .claude/skills/ directory — return zero skills rather than throwing.
    return skills;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const path = join(skillsDir, e.name, "SKILL.md");
    try {
      const raw = await readFile(path, "utf-8");
      const { data, content } = matter(raw);
      skills.push({
        name: String(data.name ?? e.name),
        description: String(data.description ?? ""),
        body: content.trim(),
      });
    } catch {
      // SKILL.md missing or unreadable — skip this directory, keep loading the rest.
    }
  }
  return skills;
}

export function formatSkillsAsSystemBlock(skills: Skill[]): string {
  if (skills.length === 0) return "";
  return `

# Available Skills

You have the following skills. Each one tells you WHEN to use it (description) and HOW to do the work (body). When the user's request matches a skill's description, follow that skill's instructions.

${skills
  .map(
    (s) => `## ${s.name}

**When to use:** ${s.description}

${s.body}`,
  )
  .join("\n\n---\n\n")}
`;
}
