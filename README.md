# AgentBreaker

**Break vulnerable AI agents. Learn how to defend real ones.**

AgentBreaker is a game in the spirit of Lakera's Gandalf that teaches AI security
engineering hands-on. Each level puts you in a chat with a deliberately vulnerable AI
agent. You read a short explanation of the attack, exploit the agent to steal a flag,
and unlock a write-up of how to defend against that attack in real systems. If you get
stuck, progressive hints guide you to the solution.

## Levels

| # | Level | Topics | Agent |
|---|-------|--------|-------|
| 1 | The Gatekeeper | Prompt injection | Guards a vault passphrase kept in its system prompt |
| 2 | Poisoned Toolbox | Tool poisoning, MCP supply-chain risks | A community MCP server hides exfiltration instructions in a tool description |
| 3 | Overpowered Assistant | Excessive agent permissions, unauthorized tool use | A support bot that holds an admin tool and "decides" who is an admin |
| 4 | Leaky Librarian | Sensitive data leakage | An HR RAG bot with a confidential document indexed |
| 5 | Shell Shocked | Insecure tool execution, excessive permissions | A network bot that builds shell commands from your input (running as root) |

Each level has:

- **Concept**: a short, plain-English explanation of the attack.
- **Challenge**: a chat with the vulnerable agent, plus a live **Tool calls** panel
  showing what the agent actually did (hidden file reads, admin exports, and so on are
  flagged as suspicious).
- **Hints**: three progressive hints per level. Each costs 15 points, so players can
  always finish without getting stuck.
- **Defense**: after you submit the flag, the game explains how to prevent the attack
  in production.

The interface is built to feel like a game: a landing page with a live attack demo,
per-agent avatars and color themes, a "defense integrity" shield that drains as you
probe and shatters on a breach, typing animations, starter prompts, a live tool-call
feed that flags suspicious actions, a "SYSTEM BREACHED" screen with confetti, an
animated score, and a responsive layout for phones.

## Guild.ai agents

Two live LLM agents are published on [Guild.ai](https://app.guild.ai) and installed in
the workspace `charannagadeep~agentbreaker`
([open workspace](https://app.guild.ai/workspaces/01a0ee5a-ed92-3bb9-0000-04d4fe6c72df)). **Learn the attack in the game, then use
the auditor to catch it in real MCP servers.**

| Agent | What it does | Source |
|-------|--------------|--------|
| `charannagadeep~agentbreaker` (default) | **Game Master**: the five levels as a live LLM game. It briefs each level, role-plays the vulnerable agent, gives hints on `hint`, scores you, and teaches the defense when you submit the flag. | [`guild-agents/game-master/`](guild-agents/game-master/) |
| `charannagadeep~mcp-tool-auditor` | **MCP Tool Auditor**: paste an MCP server's `tools/list` output, manifest, or agent skill and get a verdict (safe / review / do not install), a 0-10 risk score, findings with evidence, fixes, and a hardened version. It detects tool poisoning, hidden prompt injections, exfiltration parameters, excessive permissions, insecure execution, tool shadowing and supply-chain signals. | [`guild-agents/mcp-tool-auditor/`](guild-agents/mcp-tool-auditor/) |

```bash
npm i -g @guildai/cli && guild auth login

# Play the game
guild workspace chat --agent charannagadeep~agentbreaker --workspace charannagadeep~agentbreaker

# Audit an MCP server before installing it
guild workspace chat --agent charannagadeep~mcp-tool-auditor --workspace charannagadeep~agentbreaker \
  --once 'Audit this MCP server: {"tools":[ ... ]}'
```

Run against the poisoned `weather-plus` server from Level 2, the auditor returns
**⛔ DO NOT INSTALL, risk 10/10**. It flags the hidden `<IMPORTANT>` block that
exfiltrates `~/.ssh/id_rsa`, the `sidenote` smuggling parameter, and the scope
creep, then outputs a cleaned-up tool definition.

Both agents are built with least privilege: no tools and no access to other workspace
agents. The Game Master's prompt ends with safety rules that override player input
(it never leaves the game, never leaks other levels' flags, and refuses real-world
attack requests). The auditor treats pasted content strictly as untrusted data, so an
injection inside a tool description becomes a finding instead of an instruction.
Neither agent ever repeats real secrets.

## Quick start

Requires Python 3.11+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000.

Run the tests:

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Architecture

```
Browser (static/index.html, app.js, style.css)
   |  fetch JSON (same origin)
   v
FastAPI (app/main.py)
   - GET  /api/levels                     public level info (no flags)
   - POST /api/levels/{id}/chat           send a message to the level's agent
   - GET  /api/levels/{id}/hints/{n}      progressive hints
   - POST /api/levels/{id}/submit         server-side flag check -> defense write-up
   - security headers, rate limiting, input validation
   |
   v
Level engine (app/levels.py)
   - one simulated vulnerable agent per level
   - returns: reply text, tool calls (with a "suspicious" marker), blocked flag
   - fake file system / fake shell / fake document store, all in memory
```

The agents are deterministic simulations of real LLM failure modes rather than calls to a
live model. That makes the game free to run, works offline at a hackathon, gives every
player a consistent and solvable experience, and means nothing a player types is ever
executed.

Progress (solved levels, hints used, score) is stored in the browser's `localStorage`.
The server is stateless.

## Security features

The game is about insecure agents, so the app itself is built to be secure:

- **No real execution.** The "shell" in level 5 is a pure-Python simulation over an
  in-memory fake file system. No `subprocess`, `os.system`, `eval`, file reads, or
  outbound network calls ever run on player input.
- **Flags stay on the server.** `/api/levels` returns only public data. Answers are
  checked server-side and the defense write-up is only sent after a correct answer. A
  test asserts that no flag appears in the public level data.
- **Input validation.** Pydantic enforces message length (1-500 characters) and answer
  length (1-100); level and hint IDs are range-checked path parameters.
- **Rate limiting.** POST endpoints are limited per client IP (60 requests/minute by
  default, configurable via `RATE_LIMIT_REQUESTS`).
- **XSS-safe frontend.** All agent and user text is rendered with `textContent`. The
  frontend never uses `innerHTML`, inline scripts, inline styles, or third-party CDNs,
  and error messages shown to users come from a fixed list rather than raw exception
  text.
- **Strict security headers.** Content-Security-Policy (`default-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a Permissions-Policy, and
  `Cache-Control: no-store` on API responses.
- **Minimal attack surface.** FastAPI's interactive docs/OpenAPI endpoints are disabled,
  the server binds to `127.0.0.1` by default, and there are no secrets or API keys in the
  codebase.
- **Pinned, scanned dependencies.** Only three runtime dependencies (FastAPI, Uvicorn,
  Pydantic), pinned to exact versions and scanned with Snyk.

## Snyk scans

| Scan | Command | Result |
|------|---------|--------|
| Open source (SCA) | `snyk test --file=requirements.txt --package-manager=pip` | 14 dependencies tested, **0 vulnerable paths** |
| Code (SAST) | `snyk code test` | **0 issues** |
| Judges' scorer ([app-security-score](https://github.com/javiergarza-snyk/app-security-score)) | `node cli.mjs https://github.com/Charannagadeep/agentbreaker` | **10/10** (code H:0 M:0 L:0, dependencies H:0 M:0 L:0) |

A `poetry.lock` is committed alongside `requirements.txt` so Snyk can resolve the
dependency tree from the lockfile even in sandboxes where packages aren't installed
into the active Python. A `.snyk` policy excludes virtualenv folders, so SAST only
scans first-party code.

The project is also monitored with `snyk monitor`, so newly disclosed vulnerabilities in
its dependencies trigger alerts.

To reproduce:

```bash
snyk test --file=requirements.txt --package-manager=pip   # open-source dependencies
snyk code test                                            # static analysis (SAST)
```

## Team

Built by [Charannagadeep](https://github.com/Charannagadeep) and [Shivani Naikoti](https://github.com/shivanisam)
for the AI Security Engineering Hackathon (Snyk x AWS x Guild.ai).
