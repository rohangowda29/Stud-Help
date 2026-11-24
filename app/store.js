// Browser storage for the classroom (children on a shared device) and the sync outbox.
const STATE = "classroom.v1";
const OUTBOX = "outbox.v2";

function uuid() {
  return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STATE));
    if (s && Array.isArray(s.learners)) return s;
  } catch { /* fall through */ }
  return { deviceId: "d-" + uuid(), learners: [] };
}

export function saveState(state) {
  try { localStorage.setItem(STATE, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export function addLearner(state, name, grade) {
  const learner = { id: "l-" + uuid(), name: name.trim(), grade: Number(grade), mastery: {}, attempts: {}, recent: [] };
  return { ...state, learners: [...state.learners, learner] };
}

export function updateLearner(state, learner) {
  return { ...state, learners: state.learners.map(l => (l.id === learner.id ? learner : l)) };
}

export function readOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX)) || []; } catch { return []; }
}

export function writeOutbox(list) {
  try { localStorage.setItem(OUTBOX, JSON.stringify(list)); } catch { /* ignore */ }
}

export function clearAll() {
  try { localStorage.removeItem(STATE); localStorage.removeItem(OUTBOX); } catch { /* ignore */ }
}

// A ready-made multi-grade class for demos. Pattern: c = correct, w = wrong (oldest first).
export function seedDemo() {
  const now = Date.now();
  const mk = (name, grade, mastery, attempts, skill, pattern) => ({
    id: "l-demo-" + name.toLowerCase(),
    name, grade, mastery, attempts,
    recent: pattern.split("").map((ch, i, arr) => ({ skill, correct: ch === "c", t: now - (arr.length - i) * 60000 }))
  });
  return {
    deviceId: "d-demo",
    learners: [
      mk("Asha", 3, { addition: 0.8, subtraction: 0.6, multiplication: 0.5 }, { addition: 6, subtraction: 6, multiplication: 6 }, "multiplication", "ccwcc"),
      mk("Ravi", 3, { addition: 0.7, subtraction: 0.2, multiplication: 0.4 }, { addition: 6, subtraction: 6, multiplication: 6 }, "subtraction", "cwwwc"),
      mk("Meena", 4, { addition: 0.9, subtraction: 0.8, multiplication: 0.7 }, { addition: 7, subtraction: 7, multiplication: 7 }, "multiplication", "ccccc"),
      mk("Kiran", 2, { addition: 0.15, subtraction: 0.3, multiplication: 0.3 }, { addition: 5, subtraction: 1, multiplication: 1 }, "addition", "wcwcc"),
      mk("Lakshmi", 5, { addition: 0.8, subtraction: 0.7, multiplication: 0.1 }, { addition: 5, subtraction: 5, multiplication: 6 }, "multiplication", "cwwcw"),
      mk("Arjun", 4, {}, {}, "addition", "")
    ]
  };
}