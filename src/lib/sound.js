// Урьдчилан үүсгэсэн MP3 (npm run audio → public/audio/) байвал түүнийг тоглуулна,
// байхгүй бол браузерын TTS руу буцна. Windows дээр солонгос хоолой ихэвчлэн суугаагүй байдаг тул MP3 гол зам.
import manifest from "../data/audio-manifest.json";

export const clipUrl = (id) => (manifest[id] ? `${import.meta.env.BASE_URL}audio/${id}.mp3?v=${manifest[id]}` : null);

let current = null;

export function stopAll() {
  current?.pause();
  current = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

/**
 * ids-ийг дараалан тоглуулна. Манифестад хараахан ороогүй (дөнгөж үүссэн) файлыг ч шууд оролдоно —
 * файл үнэхээр байхгүй (404) үед л fallbackText-ийг браузерын TTS-ээр уншина.
 */
export function playClips(ids, fallbackText, rate = 1) {
  stopAll();
  const urls = ids.map((id) => clipUrl(id) ?? `${import.meta.env.BASE_URL}audio/${id}.mp3`);
  let i = 0;
  const next = () => {
    if (i >= urls.length) return;
    const a = new Audio(urls[i++]);
    a.playbackRate = rate;
    a.onended = next;
    a.onerror = () => {
      if (current === a) speakTts(fallbackText, rate);
    };
    current = a;
    a.play().catch(() => {});
  };
  next();
}

/** Дурын текстийг серверийн Edge хоолойгоор (/api/tts) уншина; бүтэхгүй бол браузерын TTS. */
export function speakText(text, rate = 1) {
  stopAll();
  speakTts(text, rate);
}

function speakTts(fallbackText, rate) {
  if (!fallbackText) return;
  const a = new Audio(`${import.meta.env.BASE_URL}api/tts?text=${encodeURIComponent(fallbackText)}`);
  a.playbackRate = rate;
  a.onerror = () => {
    if (current === a) browserTts(fallbackText, rate);
  };
  current = a;
  a.play().catch(() => {});
}

function browserTts(fallbackText, rate) {
  if (typeof speechSynthesis === "undefined" || !fallbackText) return;
  const u = new SpeechSynthesisUtterance(fallbackText);
  u.lang = "ko-KR";
  u.rate = 0.9 * rate;
  speechSynthesis.speak(u);
}

/**
 * Караоке тоглуулалт: onProgress(0..1)-ийг дуу явахын хэрээр дуудна, onEnd — дуусахад.
 * MP3 байхгүй бол TTS-ээр уншиж, текстийн уртаар явцыг тооцно. Буцаах утга — зогсоох функц.
 */
export function playWithProgress(id, text, { rate = 1, onProgress, onEnd } = {}) {
  stopAll();
  let raf = 0;
  let timer = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    onProgress?.(1);
    onEnd?.();
  };
  const fakeProgress = () => {
    // Солонгос үе бүр ~0.28 сек гэж тооцно.
    const ms = (Math.max(3, (text.match(/[가-힣]/g) ?? []).length) * 280) / rate + 400;
    const t0 = performance.now();
    timer = setInterval(() => {
      const p = (performance.now() - t0) / ms;
      if (p >= 1) finish();
      else onProgress?.(p);
    }, 60);
  };
  const a = new Audio(clipUrl(id) ?? `${import.meta.env.BASE_URL}audio/${id}.mp3`);
  a.playbackRate = rate;
  a.onended = finish;
  a.onerror = () => {
    if (current !== a) return;
    speakText(text, rate);
    fakeProgress();
  };
  const tick = () => {
    if (a.duration) onProgress?.(Math.min(1, a.currentTime / a.duration));
    raf = requestAnimationFrame(tick);
  };
  current = a;
  a.play().then(tick).catch(() => {
    // Автоплэй хориглогдвол дуугүйгээр ч тодруулгыг явуулна.
    fakeProgress();
  });
  return () => {
    done = true;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    a.pause();
  };
}

/** Явц (0..1) → одоо дуугарч буй үгийн индекс (үеийн тоогоор жинлэнэ). */
export function activeToken(tokens, p) {
  if (p <= 0) return -1;
  if (p >= 1) return tokens.length;
  const w = tokens.map((t) => Math.max(1, (t[0].match(/[가-힣]/g) ?? []).length));
  const total = w.reduce((x, y) => x + y, 0);
  // Эхний ~8% нь дууны өмнөх нам гүм.
  const target = Math.max(0, (p - 0.08) / 0.9) * total;
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (target < acc) return i;
  }
  return tokens.length - 1;
}
