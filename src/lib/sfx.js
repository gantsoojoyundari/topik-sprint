// Duolingo шиг богино дуу: зөв — дээшлэх хоёр нот, буруу — доошлох бүдэг дуу, дуусгавал — гурван нот.
// Файлгүй, WebAudio-гаар үүсгэнэ. Тохиргоо → «Дуут эффект» (settings.sfx === false)-ээр унтарна.
import { getState } from "./store.js";

let ctx = null;
function tone(freq, start, dur, type = "sine", gain = 0.18) {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const on = () => typeof window !== "undefined" && getState()?.settings?.sfx !== false;

export function sfxCorrect() {
  if (!on()) return;
  try {
    tone(784, 0, 0.12, "triangle");
    tone(1175, 0.09, 0.22, "triangle");
  } catch { /* дуу дэмжихгүй */ }
}
export function sfxWrong() {
  if (!on()) return;
  try {
    tone(330, 0, 0.16, "square", 0.08);
    tone(247, 0.12, 0.26, "square", 0.08);
  } catch { /* дуу дэмжихгүй */ }
}
export function sfxDone() {
  if (!on()) return;
  try {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.25, "triangle"));
  } catch { /* дуу дэмжихгүй */ }
}
