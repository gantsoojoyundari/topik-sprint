// Ярих / диктант дасгалын материал — зөвхөн аппын үгс, өгүүлбэр, уншлагаас.
// Сурсан үгээр бүтсэн зүйлийг түрүүлж, цөөн удаа хийсэнийг нь эхэнд тавина.
import vocab from "../data/vocab.json" with { type: "json" };
import sentences from "../data/sentences.json" with { type: "json" };
import stories from "../data/stories.json" with { type: "json" };

const basics = vocab.words.filter((w) => w.topic === "basic");

/** Бүх материал: { id, kind: "word"|"sentence", ko, mn, clip, t (tokens), ids (vocab ids) } */
export function buildItems(sentenceList = sentences, storyList = stories) {
  return [
  ...basics.map((w) => ({ id: `w:${w.id}`, kind: "word", ko: w.ko, mn: w.mn, clip: `vocab/${w.id}`, t: [[w.ko, w.mn, w.id]], ids: [w.id] })),
  ...sentenceList.map((s) => ({ id: `s:${s.id}`, kind: "sentence", ko: s.ko, mn: s.mn, clip: `sentence/${s.id}`, t: s.t, ids: s.t.map((x) => x[2]) })),
  ...storyList.flatMap((st) =>
    st.sentences.map((s, n) => ({
      id: `t:${st.id}-${n}`,
      kind: "sentence",
      ko: s.t.map((x) => x[0]).join(" "),
      mn: s.mn,
      clip: `story/${st.id}-${n}`,
      t: s.t,
      ids: s.t.map((x) => x[2]),
    })),
  ),
  ];
}
export const ALL_ITEMS = buildItems();

// Нэг өгүүлбэр уншлага, өгүүлбэр зохиох хоёуланд байвал нэгийг нь л авна.
const unique = (items) => {
  const seen = new Set();
  return items.filter((x) => !seen.has(x.ko.replace(/[.?!]/g, "")) && seen.add(x.ko.replace(/[.?!]/g, "")));
};

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

/**
 * kind: "word" | "sentence" | "mix". srs — сурсан үгс, done — {id: удаа}.
 * Бүх үг нь сурсан зүйлийг эхэнд; хангалтгүй бол шинэ үг орсныг нэмнэ.
 */
export function pickItems({ kind = "mix", n = 8, srs = {}, done = {}, items = ALL_ITEMS }) {
  const pool = unique(items).filter((x) => kind === "mix" || x.kind === kind);
  const known = (x) => x.ids.every((id) => srs[id]);
  const rank = (x) => (known(x) ? 0 : 1000) + (done[x.id] ?? 0) * 10 + Math.random();
  let list = shuffle(pool).sort((a, b) => rank(a) - rank(b)).slice(0, n);
  if (kind === "mix") {
    // Үг ба өгүүлбэрийг ээлжлүүлж, богиноос урт руу.
    list = list.sort((a, b) => a.ko.length - b.ko.length);
  }
  return list;
}

/** Харьцуулахад: зөвхөн хангыл/латин/тоо үлдээнэ. */
export const norm = (s) => (s ?? "").normalize("NFC").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/gi, "").toLowerCase();

/** Levenshtein-ээр 0..1 төстэй байдал. */
export function similarity(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a && !b) return 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[a.length][b.length] / Math.max(a.length, b.length);
}

/** Үг тус бүр хэлсэн/бичсэн текстэд байгаа эсэх (Duolingo-гийн ногоон/улаан тодруулга). */
export function tokenHits(tokens, said) {
  const s = norm(said);
  return tokens.map((t) => {
    const w = norm(t[0]);
    if (!w) return true;
    if (s.includes(w)) return true;
    // Төгсгөлийн нөхцөл бага зэрэг өөр байвал (먹어요 ~ 먹어용) — үгийн гол хэсгийг шалгана.
    return w.length >= 3 && s.includes(w.slice(0, -1));
  });
}

/** Хангыл үеийг үсгээр нь задлах — диктантын алдааг үсэг үсгээр харуулахад. */
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];
export function jamo(syl) {
  const c = syl.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171) return [syl];
  return [CHO[Math.floor(c / 588)], JUNG[Math.floor((c % 588) / 28)], JONG[c % 28]].filter(Boolean);
}
