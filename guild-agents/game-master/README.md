# AgentBreaker (Guild agent)

A Gandalf-style chat game that teaches AI security engineering. The Game Master
walks you through five levels. In each one it plays a deliberately vulnerable AI
agent that you have to break:

1. The Gatekeeper: prompt injection
2. Poisoned Toolbox: MCP tool poisoning and supply-chain risk
3. Overpowered Assistant: excessive permissions and unauthorized tool use
4. Leaky Librarian: sensitive data leakage through RAG
5. Shell Shocked: insecure tool execution (command injection)

Every level explains the concept, runs a challenge, offers three progressive
hints (`hint`), and teaches the defense once you submit the flag.

Security design:

- No tools and no workspace-agent discovery (least privilege). Every "tool call"
  in the game is simulated text.
- The prompt ends with safety rules that override player input: the Game Master
  never leaves the game, never reveals flags from other levels, refuses real-world
  attack requests, and never asks for or repeats real secrets.

Source for the full web version: https://github.com/Charannagadeep/agentbreaker
