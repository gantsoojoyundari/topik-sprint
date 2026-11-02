// Түвшин тооцох ба оноо таамаглах.

export const LEVELS = [
  { level: 6, min: 230 },
  { level: 5, min: 190 },
  { level: 4, min: 150 },
  { level: 3, min: 120 },
];

export const SECTIONS = {
  listening: { ko: "듣기", mn: "Сонсгол", color: "listening" },
  writing: { ko: "쓰기", mn: "Бичих", color: "writing" },
  reading: { ko: "읽기", mn: "Унших", color: "reading" },
};

export function levelFor(total) {
  return LEVELS.find((l) => total >= l.min)?.level ?? null; // null = түвшин тогтоогдохгүй
}

export function thresholdFor(level) {
  return LEVELS.find((l) => l.level === level)?.min ?? 120;
}

/**
 * Хэсэг бүрийн тооцоолсон оноо (100-аас).
 * Сүүлийн 60 асуултын нарийвчлалыг оношлох тесттэй жинлэж нэгтгэнэ — эхэндээ оношлогоо,
 * дадлага ихсэх тусам бодит дадлагын үр дүн давамгайлна.
 */
export function estimateSections(state) {
  const out = {};
  const n = {};
  for (const section of ["listening", "reading", "writing"]) {
    const recent = state.attempts.filter((a) => a.section === section).slice(-60);
    const correct = recent.reduce((s, a) => s + a.correct, 0);
    const total = recent.reduce((s, a) => s + a.total, 0);
    const prior = state.diagnostic?.scores?.[section];
    const priorWeight = prior != null ? 10 : 0;
    const acc =
      total + priorWeight > 0 ? (correct + (prior ?? 0) * priorWeight) / (total + priorWeight) : null;
    out[section] = acc;
    n[section] = total;
  }

  // Бичих: AI үнэлгээ байвал түүнийг (53, 54 жин ихтэй) голлоно.
  const graded = state.writings.filter((w) => w.result?.max);
  if (graded.length) {
    const recent = graded.slice(-6);
    const ratio = recent.reduce((s, w) => s + w.result.score, 0) / recent.reduce((s, w) => s + w.result.max, 0);
    out.writing = out.writing == null ? ratio : ratio * 0.7 + out.writing * 0.3;
    n.writing += recent.length * 10;
  }

  const scores = {};
  for (const k of Object.keys(out)) scores[k] = out[k] == null ? null : Math.round(out[k] * 100);
  return { scores, samples: n };
}

/** Зорилтот түвшинд хүрэх магадлал: normal CDF((таамаг − босго)/σ), σ нь өгөгдөл ихсэх тусам багасна. */
export function reachProbability(scores, samples, targetLevel) {
  const vals = Object.values(scores);
  if (vals.some((v) => v == null)) return null;
  const total = vals.reduce((a, b) => a + b, 0);
  const nSum = Object.values(samples).reduce((a, b) => a + b, 0);
  const sigma = 40 / Math.sqrt(1 + nSum / 40);
  const z = (total - thresholdFor(targetLevel)) / sigma;
  return { total, p: normalCdf(z) };
}

function normalCdf(z) {
  // Abramowitz–Stegun ойролцоолол
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
