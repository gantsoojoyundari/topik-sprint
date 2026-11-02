// Бүх хэрэглэгчийн өгөгдөл localStorage-д нэг түлхүүрээр хадгалагдана.
// Хэлбэр өөрчлөгдвөл VERSION-ийг нэмж migrate()-д шилжүүлэлт бичнэ.
import { useSyncExternalStore } from "react";
import { today } from "./dates.js";
export { streak, isActiveDay } from "./streak.js";

const KEY = "topik-sprint";
const VERSION = 1;

const EMPTY = {
  version: VERSION,
  profile: null, // { targetLevel, examDate, startDate, minutesPerDay }
  diagnostic: null, // { scores: { listening, reading, writing, vocab }, completedAt }
  srs: {}, // wordId → card
  mistakes: [], // { key, kind, qid, chosen, at, resolved }
  log: {}, // "YYYY-MM-DD" → { done: { taskId: true }, reviews, newWords }
  attempts: [], // { section, correct, total, at, source }
  writings: [], // { id, task, answer, result, at }
  mocks: [], // { at, scores: { listening, writing, reading }, total, level }
  sentences: {}, // sentenceId → анхны оролдлогоор зөв хийсэн тоо
  hangul: {}, // letterId → зөв хариулсан тоо (2+ = сурсан)
  settings: { theme: "light", galig: true },
};

function migrate(data) {
  if (!data || typeof data !== "object") return structuredClone(EMPTY);
  const out = { ...structuredClone(EMPTY), ...data, version: VERSION };
  // Ягаан theme-д шилжсэн: хуучин «систем» тохиргоог (бараан Windows дээр хар болдог) цайвар ягаан болгоно.
  if (!out.settings?.pinkTheme) out.settings = { ...out.settings, theme: "light", pinkTheme: true };
  return out;
}

function load() {
  try {
    return migrate(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Хадгалах зай дүүрсэн эсвэл хувийн цонх — апп ажилласаар байна.
  }
}

export function getState() {
  return state;
}

/** fn(draft) нь шинэ state буцаана эсвэл draft-ийг өөрчилнө. */
export function update(fn) {
  const draft = structuredClone(state);
  const next = fn(draft) ?? draft;
  state = next;
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function resetAll() {
  state = structuredClone(EMPTY);
  persist();
  listeners.forEach((l) => l());
}

// ---------- Туслах үйлдлүүд ----------

export function dayLog(s, date = today()) {
  return s.log[date] ?? { done: {}, reviews: 0, newWords: 0 };
}

export function markTask(taskId, done = true, date = today()) {
  update((s) => {
    const d = dayLog(s, date);
    if (done) d.done[taskId] = true;
    else delete d.done[taskId];
    s.log[date] = d;
  });
}

export function recordAttempt(section, correct, total, source) {
  update((s) => {
    s.attempts.push({ section, correct, total, source, at: Date.now() });
  });
}

export function recordMistake(kind, qid, chosen) {
  update((s) => {
    const key = `${kind}:${qid}`;
    const existing = s.mistakes.find((m) => m.key === key);
    if (existing) {
      existing.chosen = chosen;
      existing.at = Date.now();
      existing.resolved = false;
      existing.count = (existing.count ?? 1) + 1;
    } else {
      s.mistakes.push({ key, kind, qid, chosen, at: Date.now(), resolved: false, count: 1 });
    }
  });
}

export function resolveMistake(key) {
  update((s) => {
    const m = s.mistakes.find((x) => x.key === key);
    if (m) m.resolved = true;
  });
}
