import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { levelFor, updateMastery, pickNext, recordAnswer, needsHelp } from "../adaptive.js";

test("levelFor follows the mastery thresholds", () => {
  assert.equal(levelFor(0.1), 1);
  assert.equal(levelFor(0.4), 2);
  assert.equal(levelFor(0.69), 2);
  assert.equal(levelFor(0.7), 3);
});

test("updateMastery stays within 0..1 and does not mutate its input", () => {
  const m = { addition: 0.95 };
  const up = updateMastery(m, "addition", true);
  assert.equal(up.addition, 1);
  assert.equal(m.addition, 0.95);
  assert.equal(updateMastery({ addition: 0.05 }, "addition", false).addition, 0);
});

test("pickNext targets the weakest skill at the matching level", () => {
  const items = [];
  for (const skill of ["a", "b", "c"]) for (const level of [1, 2, 3]) items.push({ id: `${skill}${level}`, skill, level });
  const next = pickNext(items, { a: 0.8, b: 0.1, c: 0.5 }, null, () => 0);
  assert.equal(next.skill, "b");
  assert.equal(next.level, 1);
});

test("pickNext avoids repeating the last question", () => {
  const items = [{ id: "x1", skill: "a", level: 1 }, { id: "x2", skill: "a", level: 1 }];
  assert.equal(pickNext(items, {}, "x1", () => 0).id, "x2");
});

test("recordAnswer counts attempts and keeps only the last 10 answers", () => {
  let l = { mastery: {}, attempts: {}, recent: [] };
  for (let i = 0; i < 12; i++) l = recordAnswer(l, "addition", i % 2 === 0, i);
  assert.equal(l.attempts.addition, 12);
  assert.equal(l.recent.length, 10);
});

test("needsHelp flags struggling children, new children and children on track", () => {
  const wrong = [0, 1, 2, 3, 4].map(t => ({ skill: "subtraction", correct: t === 0, t }));
  const struggling = { mastery: { subtraction: 0.3 }, attempts: { subtraction: 5 }, recent: wrong };
  assert.deepEqual(needsHelp(struggling), { status: "help", skill: "subtraction", reason: "recent" });

  const lowMastery = { mastery: { addition: 0.1 }, attempts: { addition: 5 }, recent: [] };
  assert.equal(needsHelp(lowMastery).reason, "mastery");

  assert.equal(needsHelp({ mastery: {}, attempts: {}, recent: [] }).status, "new");

  const fine = { mastery: { addition: 0.8 }, attempts: { addition: 6 }, recent: [{ skill: "addition", correct: true, t: 1 }] };
  assert.equal(needsHelp(fine).status, "ok");
});

test("content pack is well formed in every language", () => {
  const pack = JSON.parse(readFileSync(new URL("../content/pack-v1.json", import.meta.url), "utf8"));
  const ids = new Set();
  for (const item of pack.items) {
    assert.ok(!ids.has(item.id), "duplicate id " + item.id);
    ids.add(item.id);
    assert.equal(new Set(item.options).size, 4, item.id + " needs 4 distinct options");
    assert.ok(item.options.includes(item.answer), item.id + " answer missing from options");
    for (const lang of pack.languages) assert.ok(item.prompt[lang], item.id + " missing " + lang);
  }
  for (const lang of pack.languages) {
    for (const key of Object.keys(pack.ui.en)) assert.ok(pack.ui[lang][key], `ui ${lang}.${key} missing`);
  }
});