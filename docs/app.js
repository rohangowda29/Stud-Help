
import { pickNext, recordAnswer } from "./adaptive.js";
import { loadState, saveState, addLearner, updateLearner, readOutbox, writeOutbox } from "./store.js";
import { SYNC_URL } from "./config.js";

const $ = id => document.getElementById(id);
const LANG = "lang";
const BATCH = 200;

let pack;
let lang = localStorage.getItem(LANG) || "en";
let state = loadState();
let learner = null;
let current = null;
let lastId = null;
let flushing = false;

const ui = key => pack.ui[lang][key];

function show(screen) {
  $("picker").hidden = screen !== "picker";
  $("practice").hidden = screen !== "practice";
}

function renderStatus() {
  const pending = readOutbox().length;
  const base = navigator.onLine ? ui("online") : ui("offline");
  $("status").textContent = pending ? `${base} (${pending} ${ui("pending")})` : base;
}

function renderPicker() {
  const box = $("children");
  box.textContent = "";
  state.learners.forEach(l => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${l.name}  ·  ${ui("grade")} ${l.grade}`;
    b.addEventListener("click", () => choose(l.id));
    box.appendChild(b);
  });
}

function renderMastery() {
  const list = $("mastery");
  list.textContent = "";
  Object.keys(pack.skills).forEach(s => {
    const pct = Math.round(((learner && learner.mastery[s]) ?? 0.3) * 100);
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = pack.skills[s][lang];
    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = 100;
    meter.value = pct;
    meter.textContent = pct + "%";
    li.append(label, meter);
    list.appendChild(li);
  });
}

function renderLabels() {
  document.documentElement.lang = lang;
  $("title").textContent = ui("title");
  $("whoTitle").textContent = ui("whoAreYou");
  $("addTitle").textContent = ui("addChild");
  $("nameLabel").textContent = ui("name");
  $("gradeLabel").textContent = ui("grade");
  $("addBtn").textContent = ui("add");
  $("switch").textContent = ui("switch");
  $("listen").textContent = ui("listen");
  $("next").textContent = ui("next");
  $("teacherLink").textContent = ui("teacher");
  renderStatus();
  renderPicker();
  if (learner) renderMastery();
}

function choose(id) {
  learner = state.learners.find(l => l.id === id);
  $("childName").textContent = learner.name;
  lastId = null;
  show("practice");
  renderMastery();
  ask();
}

function ask() {
  // Use only questions with audio in the selected language.
  const playableItems = pack.items.filter(
    item => item.audio && item.audio[lang]
  );

  const availableItems = playableItems.length ? playableItems : pack.items;

  current = pickNext(availableItems, learner.mastery, lastId);
  lastId = current.id;

  $("prompt").textContent = current.prompt[lang];
  $("feedback").textContent = "";
  $("next").hidden = true;

  const box = $("options");
  box.textContent = "";

  current.options.forEach(opt => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = opt;
    b.addEventListener("click", () => answer(opt, b));
    box.appendChild(b);
  });
}

function answer(value, button) {
  const correct = value === current.answer;

  learner = recordAnswer(learner, current.skill, correct);
  state = updateLearner(state, learner);
  saveState(state);

  const out = readOutbox();
  out.push({
    learnerId: learner.id,
    t: Date.now(),
    skill: current.skill,
    level: current.level,
    correct
  });
  writeOutbox(out);

  $("feedback").textContent = correct ? ui("correct") : ui("wrong");
  button.dataset.result = correct ? "right" : "wrong";
  button.disabled = true;

  if (correct) {
    [...$("options").children].forEach(b => (b.disabled = true));
    $("next").hidden = false;
  }

  renderMastery();
  renderStatus();
  flush();
}

function speak() {
  const clip = current.audio && current.audio[lang];

  if (clip) {
    const audio = new Audio(clip);

    audio.addEventListener("error", () => {
      console.error("Could not play audio:", clip);
    });

    audio.play().catch(error => {
      console.error("Audio playback failed:", error);
    });

    return;
  }

  // Browser speech fallback only when no recorded audio exists.
  if ("speechSynthesis" in window) {
    const text = (current.say && current.say[lang]) || current.prompt[lang];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = { en: "en-IN", hi: "hi-IN", kn: "kn-IN" }[lang] || "en-IN";
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }
}

async function flush() {
  if (flushing || !SYNC_URL || !navigator.onLine) return;

  flushing = true;
  let sent = 0;

  try {
    while (true) {
      const batch = readOutbox().slice(0, BATCH);
      if (!batch.length) break;

      const res = await fetch(SYNC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: state.deviceId, events: batch })
      });

      if (!res.ok) break;

      writeOutbox(readOutbox().slice(batch.length));
      sent += batch.length;
    }
  } catch {
    // Keep events queued and retry later.
  }

  flushing = false;

  if (sent) {
    $("status").textContent = ui("synced");
    setTimeout(renderStatus, 2000);
  } else {
    renderStatus();
  }
}

async function init() {
  const res = await fetch("content/pack-v1.json");
  pack = await res.json();

  if (!pack.languages.includes(lang)) lang = "en";

  $("lang").innerHTML = pack.languages
    .map(l => `<option value="${l}">${l}</option>`)
    .join("");

  $("lang").value = lang;

  $("newGrade").innerHTML = [1, 2, 3, 4, 5]
    .map(g => `<option value="${g}">${g}</option>`)
    .join("");

  $("lang").addEventListener("change", e => {
    lang = e.target.value;
    localStorage.setItem(LANG, lang);
    renderLabels();

    if (learner) {
      lastId = null;
      ask();
    }
  });

  $("addBtn").addEventListener("click", () => {
    const name = $("newName").value.trim();

    if (!name) {
      $("newName").focus();
      return;
    }

    state = addLearner(state, name, $("newGrade").value);
    saveState(state);
    $("newName").value = "";
    renderPicker();
  });

  $("newName").addEventListener("keydown", e => {
    if (e.key === "Enter") $("addBtn").click();
  });

  $("switch").addEventListener("click", () => {
    learner = null;
    show("picker");
    renderPicker();
  });

  $("listen").addEventListener("click", speak);
  $("next").addEventListener("click", ask);

  window.addEventListener("online", () => {
    renderStatus();
    flush();
  });

  window.addEventListener("offline", renderStatus);

  renderLabels();
  show("picker");
  flush();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
