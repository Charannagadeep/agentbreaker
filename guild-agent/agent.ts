import { llmAgent } from "@guildai/agents-sdk";
import systemPrompt from "./system-prompt.md";

export default llmAgent({
  description:
    "AgentBreaker: a Gandalf-style game that teaches AI security engineering. Break six deliberately vulnerable AI agents (prompt injection, tool poisoning, MCP supply chain, excessive permissions, data leakage, insecure tool execution), with hints and defense write-ups.",
  tools: {},
  systemPrompt,
  mode: "multi-turn",
  useWorkspaceAgents: false,
});
