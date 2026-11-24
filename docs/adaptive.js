// Pure logic for adaptive practice and the teacher "needs help" signal.
// No browser APIs here, so it can be unit-tested with plain Node.
export const START = 0.3;

const clamp = x => Math.min(1, Math.max(0, x));

export function levelFor(mastery) {
  if (mastery < 0.4) return 1;
  if (mastery < 0.7) return 2;
  return 3;
}

export function updateMastery(mastery, skill, correct) {
  const current = mastery[skill] ?? START;
  return { ...mastery, [skill]: clamp(current + (correct ? 0.15 : -0.1)) };
}

// Pick the weakest skill, then a question at the level that matches its mastery.
export function pickNext(items, mastery, lastId, rand = Math.random) {
  const skills = [...new Set(items.map(i => i.skill))];
  const weakest = skills.reduce((a, b) => ((mastery[a] ?? START) <= (mastery[b] ?? START) ? a : b));
  const level = levelFor(mastery[weakest] ?? START);
  const pool = items.filter(i => i.skill === weakest && i.level === level && i.id !== lastId);
  const fallback = items.filter(i => i.id !== lastId);
  const list = pool.length ? pool : fallback;
  return list[Math.floor(rand() * list.length)];
}

// Returns a new learner record with the answer applied (the input is not mutated).
export function recordAnswer(learner, skill, correct, now = Date.now()) {
  const attempts = { ...(learner.attempts || {}) };
  attempts[skill] = (attempts[skill] || 0) + 1;
  const recent = [...(learner.recent || []), { skill, correct, t: now }].slice(-10);
  return { ...learner, mastery: updateMastery(learner.mastery || {}, skill, correct), attempts, recent };
}

// status: "new" (no answers yet), "help" (teacher should step in), or "ok".
export function needsHelp(learner) {
  const mastery = learner.mastery || {};
  const attempts = learner.attempts || {};
  const tried = Object.keys(attempts).filter(s => attempts[s] > 0);
  if (!tried.length) return { status: "new", skill: null, reason: null };

  const weakest = tried.reduce((a, b) => ((mastery[a] ?? START) <= (mastery[b] ?? START) ? a : b));
  const recent = (learner.recent || []).slice(-5);
  const wrong = recent.filter(r => !r.correct).length;

  if (recent.length >= 3 && wrong >= 3) return { status: "help", skill: weakest, reason: "recent" };
  if (attempts[weakest] >= 4 && (mastery[weakest] ?? START) < 0.25) return { status: "help", skill: weakest, reason: "mastery" };
  return { status: "ok", skill: weakest, reason: null };
}