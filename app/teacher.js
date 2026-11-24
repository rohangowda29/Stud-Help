import { needsHelp } from "./adaptive.js";
import { loadState, saveState, seedDemo, clearAll } from "./store.js";

const $ = id => document.getElementById(id);
const ORDER = { help: 0, ok: 1, new: 2 };
const REASON = {
  recent: "3 or more wrong in the last 5 answers",
  mastery: "mastery still below 25% after 4+ tries"
};

let pack;

function skillName(s) { return pack.skills[s] ? pack.skills[s].en : s; }

function row(learner, help) {
  const li = document.createElement("li");
  li.className = "student " + help.status;

  const head = document.createElement("div");
  head.className = "head";
  const name = document.createElement("strong");
  name.textContent = learner.name;
  const grade = document.createElement("span");
  grade.textContent = "Class " + learner.grade;
  const badge = document.createElement("span");
  badge.className = "badge " + help.status;
  badge.textContent = help.status === "help" ? "Needs help" : help.status === "ok" ? "On track" : "Not started";
  head.append(name, grade, badge);
  li.appendChild(head);

  if (help.status === "help") {
    const why = document.createElement("p");
    why.className = "why";
    why.textContent = `${skillName(help.skill)}: ${REASON[help.reason]}`;
    li.appendChild(why);
  }

  const bars = document.createElement("ul");
  bars.className = "bars";
  Object.keys(pack.skills).forEach(s => {
    const pct = Math.round(((learner.mastery || {})[s] ?? 0.3) * 100);
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = skillName(s);
    const meter = document.createElement("meter");
    meter.min = 0; meter.max = 100; meter.value = pct;
    meter.textContent = pct + "%";
    item.append(label, meter);
    bars.appendChild(item);
  });
  li.appendChild(bars);
  return li;
}

function render() {
  const state = loadState();
  const rows = state.learners
    .map(l => ({ l, h: needsHelp(l) }))
    .sort((a, b) => ORDER[a.h.status] - ORDER[b.h.status] || a.l.name.localeCompare(b.l.name));

  const helpCount = rows.filter(r => r.h.status === "help").length;
  $("summary").textContent = rows.length
    ? `${helpCount} of ${rows.length} children need your help now.`
    : "No children yet. Add children on the practice screen, or load the demo class.";

  const list = $("roster");
  list.textContent = "";
  rows.forEach(r => list.appendChild(row(r.l, r.h)));
}

async function init() {
  pack = await (await fetch("content/pack-v1.json")).json();
  $("demo").addEventListener("click", () => { saveState(seedDemo()); render(); });
  $("clear").addEventListener("click", () => {
    if (confirm("Delete all children and progress on this device?")) { clearAll(); render(); }
  });
  window.addEventListener("storage", render);
  render();
}

init();