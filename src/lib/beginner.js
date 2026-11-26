// Эхлэгчийн дараалал: үсэг → энгийн үг → уншлага/ярих/диктант → сонсгол → өгүүлбэр → TOPIK II.
// Цэвэр функц — tests/beginner.test.js-ээр шалгагдана.
import hangul from "../data/hangul.json" with { type: "json" };
import vocab from "../data/vocab.json" with { type: "json" };

const LEARNED = 2; // Hangul.jsx-тэй ижил
const BASIC_LETTERS = hangul.letters.filter((l) => l.group === "consonant" || l.group === "vowel");
const BASIC_WORDS = vocab.words.filter((w) => w.topic === "basic");

// need: хэдэн анхан шатны үг сурсны дараа нээгдэх. rotate: өдөр бүр эдгээрээс зөвхөн нэг нь даалгавар болно.
export const STEPS = [
  { id: "hangul", n: 1, title: "Хангыл үсэг", route: "#/hangul", section: "vocab", minutes: 15, detail: "Үсэг бүрийг сонсоод, дасгал хий" },
  { id: "vocab", n: 2, title: "Энгийн үгс", route: "#/vocab", section: "vocab", minutes: 15, detail: "Шинэ үгийг хараад, сонсоод сур" },
  { id: "stories", n: 3, need: 20, rotate: true, title: "Богино уншлага", route: "#/stories", section: "reading", minutes: 10, detail: "Уншаад «Дараах» дарж орчуулгыг хар" },
  { id: "speaking", n: 4, need: 20, rotate: true, title: "Ярих", route: "#/speaking", section: "listening", minutes: 10, detail: "Сонсоод, микрофонд давтаж хэл" },
  { id: "dictation", n: 5, need: 20, rotate: true, title: "Сонсоод бичих", route: "#/dictation", section: "writing", minutes: 10, detail: "Сонссон үгээ солонгосоор бич" },
  { id: "listening", n: 6, need: 40, title: "Энгийн сонсгол", route: "#/easy-listening", section: "listening", minutes: 10, detail: "Сонсоод утгыг нь сонго" },
  { id: "sentence", n: 7, need: 60, title: "Өгүүлбэр зохиох", route: "#/sentences", section: "writing", minutes: 10, detail: "Үгсийг зөв дараалалд тавь" },
];

export function beginnerState({ hangul: hs = {}, srs = {}, settings = {} }) {
  const lettersAll = hangul.letters.filter((l) => (hs[l.id] ?? 0) >= LEARNED).length;
  const lettersBasic = BASIC_LETTERS.filter((l) => (hs[l.id] ?? 0) >= LEARNED).length;
  const words = BASIC_WORDS.filter((w) => srs[w.id]).length;
  const unlocked = { hangul: true, vocab: lettersBasic >= BASIC_LETTERS.length };
  for (const s of STEPS) if (s.need) unlocked[s.id] = words >= s.need;
  // Админы «Бүгдийг нээх»: түгжээг тойрно (явц өөрчлөгдөхгүй).
  if (settings.unlockAll) for (const s of STEPS) unlocked[s.id] = true;
  const lettersDone = lettersAll === hangul.letters.length;
  return {
    lettersAll,
    lettersBasic,
    lettersTotal: hangul.letters.length,
    basicLettersTotal: BASIC_LETTERS.length,
    words,
    wordsTotal: BASIC_WORDS.length,
    unlocked,
    // Үндсэн бүх үсэг + анхан шатны бүх үг → TOPIK II хэсгүүд нээгдэнэ.
    graduated: lettersDone && words >= BASIC_WORDS.length,
  };
}

const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) || 0;

/** Эхлэгчийн өдрийн даалгавар (нээгдсэн алхмууд л). Уншлага/ярих/диктант өдөр бүр ээлжилнэ. */
export function beginnerTasks(b, date) {
  const open = STEPS.filter((s) => b.unlocked[s.id]).filter((s) => !(s.id === "hangul" && b.lettersAll === b.lettersTotal));
  const rot = open.filter((s) => s.rotate);
  const todayRot = rot.length ? rot[dayNumber(date) % rot.length].id : null;
  return open
    .filter((s) => !s.rotate || s.id === todayRot)
    .map((s) => ({ id: `${date}:${s.id}`, kind: s.id, section: s.section, title: s.title, route: s.route, minutes: s.minutes, detail: s.detail }));
}
