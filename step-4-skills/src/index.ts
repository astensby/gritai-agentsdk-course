import { query } from "@anthropic-ai/claude-agent-sdk";

const rawNotes = `
Quick sync about the Q3 launch.
We decided to push the launch from June 15 to June 30 to give us time for a security review.
Anna will lead the security review and coordinate with the platform team.
We still need to figure out what to do about the marketing campaign that's already booked
for June 15 — open question for the marketing team.
Action: Bob to draft revised comms by next Friday.
Action: Anna to share the security review checklist on Monday.
We also touched on the Q4 roadmap but parked it for next time.
`;

const response = query({
  prompt: `Here are my raw meeting notes — please format them:\n\n${rawNotes}`,
  options: {
    model: "claude-sonnet-5-5",

    // Skills are discovered from your on-disk "setting sources." The SDK
    // default is ["user", "project", "local"] (all of them), so
    // .claude/skills/ already loads even if you omit this line. We pass
    // ["project"] on purpose: it SCOPES discovery to this folder, so workshop
    // runs depend only on the skill shipped here — not on whatever you happen
    // to have in your personal ~/.claude. Pass [] to turn skill discovery off
    // entirely (the SDK's "isolation mode").
    settingSources: ["project"],
  },
});

for await (const message of response) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      }
    }
  } else if (message.type === "result") {
    console.log(`\n\n---\nCost: $${message.total_cost_usd.toFixed(6)}`);
  }
}
