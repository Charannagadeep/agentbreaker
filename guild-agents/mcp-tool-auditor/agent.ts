import { llmAgent } from "@guildai/agents-sdk";
import systemPrompt from "./system-prompt.md";

export default llmAgent({
  description:
    "MCP Tool Auditor: paste an MCP server's tools/list output, manifest, or agent skill and get a security verdict covering tool poisoning, hidden prompt injections, data exfiltration, excessive permissions, insecure execution, and supply-chain risks, with fixes.",
  tools: {},
  systemPrompt,
  mode: "one-shot",
  useWorkspaceAgents: false,
});
