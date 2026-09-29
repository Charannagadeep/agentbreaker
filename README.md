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
| 2 | Filter Frenzy | Prompt injection, sensitive data leakage | Adds keyword input/output filters you must bypass |
| 3 | Poisoned Toolbox | Tool poisoning, MCP supply-chain risks | A community MCP server hides exfiltration instructions in a tool description |
| 4 | Overpowered Assistant | Excessive agent permissions, unauthorized tool use | A support bot that holds an admin tool and "decides" who is an admin |
| 5 | Leaky Librarian | Sensitive data leakage | An HR RAG bot with a confidential document indexed |
| 6 | Shell Shocked | Insecure tool execution, excessive permissions | A network bot that builds shell commands from your input (running as root) |

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

## Guild agent (live LLM version)

The same six levels also run as a live LLM chat agent hosted on
[Guild.ai](https://app.guild.ai): agent `charannagadeep~agentbreaker` in the
workspace `charannagadeep~agentbreaker`. A Game Master briefs each level, role-plays
the vulnerable agent, gives hints on `hint`, and teaches the defense when you submit
the flag. Source: [`guild-agent/`](guild-agent/).

```bash
npm i -g @guildai/cli && guild auth login
guild workspace chat --agent charannagadeep~agentbreaker --workspace charannagadeep~agentbreaker
```

The Guild agent is built with least privilege: no tools and no access to other
workspace agents (every "tool call" in the game is simulated text), and its prompt
ends with safety rules that override player input. It never leaves the game,
never leaks flags from other levels, refuses real-world attack requests, and
never asks for or repeats real secrets.

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

- **No real execution.** The "shell" in level 6 is a pure-Python simulation over an
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

The project is also monitored with `snyk monitor`, so newly disclosed vulnerabilities in
its dependencies trigger alerts.

To reproduce:

```bash
snyk test --file=requirements.txt --package-manager=pip   # open-source dependencies
snyk code test                                            # static analysis (SAST)
```

## Team

Built by [Charannagadeep](https://github.com/Charannagadeep) for the AI Security
Engineering Hackathon (Snyk x AWS).
