# MCP Tool Auditor (Guild agent)

Paste an MCP server's `tools/list` output, a manifest, or an agent skill file, and get
a security verdict before you install it:

- Tool poisoning and hidden prompt injections in descriptions
- Data exfiltration channels (URLs, smuggling parameters like `sidenote`)
- Excessive permissions for the server's stated purpose
- Insecure execution (shell, eval, unconstrained parameters)
- Cross-tool shadowing and supply-chain / rug-pull signals

Output: a verdict (safe / review / do not install), a 0-10 risk score, a findings table
with evidence, concrete fixes, and a hardened version of the tool definitions.

Security design: no tools and no workspace-agent access (least privilege). Pasted
content is treated strictly as untrusted data, so injection attempts inside tool
descriptions become findings instead of instructions.

Companion to [AgentBreaker](https://github.com/Charannagadeep/agentbreaker): learn the
attack in the game, then use this agent to catch it in real MCP servers.
