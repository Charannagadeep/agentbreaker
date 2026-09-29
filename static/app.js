"use strict";

const STORAGE_KEY = "agentbreaker-progress-v1";
const HINT_COST = 15;

const state = {
  levels: [],
  current: null,
  progress: loadProgress(),
};

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      solved: parsed.solved && typeof parsed.solved === "object" ? parsed.solved : {},
      hints: parsed.hints && typeof parsed.hints === "object" ? parsed.hints : {},
    };
  } catch {
    return { solved: {}, hints: {} };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch { /* keep default */ }
    throw new Error(detail);
  }
  return res.json();
}

function hintsUsed(levelId) {
  return state.progress.hints[levelId] || [];
}

function renderScore() {
  let score = 0;
  for (const level of state.levels) {
    if (state.progress.solved[level.id]) {
      score += Math.max(level.points - hintsUsed(level.id).length * HINT_COST, 25);
    }
  }
  const solvedCount = state.levels.filter((l) => state.progress.solved[l.id]).length;
  document.getElementById("score").textContent = String(score);
  document.getElementById("solved").textContent = `${solvedCount}/${state.levels.length}`;
}

function renderLevelList() {
  const list = document.getElementById("level-list");
  list.replaceChildren();
  for (const level of state.levels) {
    const li = el("li");
    const btn = el("button", "level-btn");
    btn.type = "button";
    if (state.current && state.current.id === level.id) btn.classList.add("active");
    if (state.progress.solved[level.id]) btn.classList.add("solved");
    btn.append(el("span", "level-num", String(level.id)));
    const text = el("span", "level-text");
    text.append(el("span", "level-name", level.title));
    text.append(el("span", "level-topic", level.topics.join(" · ")));
    btn.append(text);
    btn.append(el("span", "level-check", state.progress.solved[level.id] ? "✓" : ""));
    btn.addEventListener("click", () => selectLevel(level.id));
    li.append(btn);
    list.append(li);
  }
}

function addMessage(role, text, opts = {}) {
  const messages = document.getElementById("messages");
  const wrap = el("div", `msg ${role}${opts.blocked ? " blocked" : ""}`);
  const who = role === "user" ? "You" : role === "system" ? "Game" : state.current.agent_name;
  wrap.append(el("div", "who", who));
  wrap.append(el("div", "bubble", text));
  messages.append(wrap);
  messages.scrollTop = messages.scrollHeight;
}

function renderTools(level) {
  const list = document.getElementById("tool-list");
  list.replaceChildren();
  if (!level.tools.length) {
    list.append(el("li", "empty", "This agent has no tools, just a system prompt."));
    return;
  }
  for (const tool of level.tools) {
    const li = el("li");
    li.append(el("code", null, tool.name));
    li.append(el("span", "tool-server", tool.server));
    li.append(el("p", "tool-desc", tool.description));
    list.append(li);
  }
}

function resetTrace() {
  const trace = document.getElementById("trace");
  trace.replaceChildren(el("li", "empty", "No tool calls yet."));
}

function addTrace(calls) {
  if (!calls.length) return;
  const trace = document.getElementById("trace");
  const empty = trace.querySelector(".empty");
  if (empty) empty.remove();
  for (const call of calls) {
    const li = el("li", call.suspicious ? "suspicious" : "");
    const head = el("div", "trace-head");
    head.append(el("code", null, call.tool));
    if (call.suspicious) head.append(el("span", "badge", "suspicious"));
    li.append(head);
    li.append(el("pre", "trace-args", JSON.stringify(call.args, null, 2)));
    li.append(el("p", "trace-result", `→ ${call.result}`));
    trace.prepend(li);
  }
}

function renderHints(level) {
  const list = document.getElementById("hints");
  list.replaceChildren();
  const used = hintsUsed(level.id);
  for (const hint of used) list.append(el("li", null, hint));
  document.getElementById("hint-counter").textContent = `(${used.length}/${level.hint_count})`;
  const btn = document.getElementById("hint-btn");
  btn.disabled = used.length >= level.hint_count;
  btn.textContent = btn.disabled ? "No more hints" : `Reveal a hint (-${HINT_COST} pts)`;
}

async function revealHint() {
  const level = state.current;
  const used = hintsUsed(level.id);
  if (used.length >= level.hint_count) return;
  try {
    const data = await api(`/api/levels/${level.id}/hints/${used.length + 1}`);
    state.progress.hints[level.id] = [...used, data.hint];
    saveProgress();
    renderHints(level);
    renderScore();
  } catch (err) {
    addMessage("system", err.message);
  }
}

function showDefense(text) {
  document.getElementById("defense-text").textContent = text;
  document.getElementById("defense").hidden = false;
  const isLast = state.levels[state.levels.length - 1].id === state.current.id;
  document.getElementById("next-btn").textContent = isLast ? "Back to level 1" : "Next level →";
}

function selectLevel(id) {
  const level = state.levels.find((l) => l.id === id);
  if (!level) return;
  state.current = level;
  document.getElementById("level-title").textContent = `Level ${level.id}: ${level.title}`;
  const topics = document.getElementById("level-topics");
  topics.replaceChildren(...level.topics.map((t) => el("span", "chip", t)));
  document.getElementById("level-concept").textContent = level.concept;
  document.getElementById("level-objective").textContent = level.objective;
  document.getElementById("messages").replaceChildren();
  document.getElementById("flag-result").textContent = "";
  document.getElementById("flag-result").className = "flag-result";
  document.getElementById("flag-input").value = "";
  document.getElementById("defense").hidden = true;
  addMessage("agent", level.greeting);
  renderTools(level);
  resetTrace();
  renderHints(level);
  renderLevelList();
  const solved = state.progress.solved[level.id];
  if (solved) showDefense(solved);
  document.getElementById("chat-input").focus();
}

async function sendMessage(event) {
  event.preventDefault();
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addMessage("user", message);
  const levelId = state.current.id;
  try {
    const data = await api(`/api/levels/${levelId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    if (state.current.id !== levelId) return;
    addMessage("agent", data.reply, { blocked: data.blocked });
    addTrace(data.tool_calls);
  } catch (err) {
    addMessage("system", err.message);
  }
}

async function submitFlag(event) {
  event.preventDefault();
  const input = document.getElementById("flag-input");
  const answer = input.value.trim();
  if (!answer) return;
  const result = document.getElementById("flag-result");
  try {
    const data = await api(`/api/levels/${state.current.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    if (data.correct) {
      result.textContent = "Correct! Level cleared.";
      result.className = "flag-result ok";
      state.progress.solved[state.current.id] = data.defense;
      saveProgress();
      showDefense(data.defense);
      renderLevelList();
      renderScore();
      addMessage("system", `Level cleared! You broke ${state.current.agent_name}. Read the defense notes, then move on.`);
    } else {
      result.textContent = "Not quite. Keep poking at the agent, or grab a hint.";
      result.className = "flag-result bad";
    }
  } catch (err) {
    result.textContent = err.message;
    result.className = "flag-result bad";
  }
}

function nextLevel() {
  const idx = state.levels.findIndex((l) => l.id === state.current.id);
  const next = state.levels[(idx + 1) % state.levels.length];
  selectLevel(next.id);
}

function resetProgress() {
  if (!window.confirm("Reset all progress and hints?")) return;
  state.progress = { solved: {}, hints: {} };
  saveProgress();
  renderScore();
  selectLevel(state.levels[0].id);
}

async function init() {
  document.getElementById("chat-form").addEventListener("submit", sendMessage);
  document.getElementById("flag-form").addEventListener("submit", submitFlag);
  document.getElementById("hint-btn").addEventListener("click", revealHint);
  document.getElementById("next-btn").addEventListener("click", nextLevel);
  document.getElementById("reset").addEventListener("click", resetProgress);
  try {
    state.levels = await api("/api/levels");
  } catch (err) {
    document.getElementById("level-title").textContent = `Could not load levels: ${err.message}`;
    return;
  }
  renderScore();
  const firstUnsolved = state.levels.find((l) => !state.progress.solved[l.id]) || state.levels[0];
  selectLevel(firstUnsolved.id);
}

document.addEventListener("DOMContentLoaded", init);
