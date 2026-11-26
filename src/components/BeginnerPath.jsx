import { STEPS } from "../lib/beginner.js";
import { getConfig } from "../lib/content.js";
import { Card, Bar, Bow, cx } from "./ui.jsx";

/** Эхлэгчийн алхмууд — нээгдсэн, түгжээтэй, явцтай нь. */
export function BeginnerPath({ b }) {
  const progress = {
    hangul: [b.lettersAll, b.lettersTotal],
    vocab: [b.words, b.wordsTotal],
  };
  const lockNote = { vocab: `Үндсэн ${b.basicLettersTotal} үсгээ сурвал нээгдэнэ (${b.lettersBasic}/${b.basicLettersTotal})` };
  const cfg = getConfig();
  const needOf = (s) => (s.id === "listening" ? cfg.listeningAt : s.id === "sentence" ? cfg.sentenceAt : s.need);
  for (const s of STEPS) if (s.need) lockNote[s.id] = !b.unlocked[s.id] && cfg[s.id] === false ? "Админ түр хаасан" : `${needOf(s)} үг сурвал нээгдэнэ (${Math.min(b.words, needOf(s))}/${needOf(s)})`;
  return (
    <Card className="relative space-y-3">
      <Bow className="absolute -right-2 -top-3 w-10 rotate-12" />
      <div>
        <p className="font-semibold">Эхлэгчийн зам</p>
        <p className="text-sm text-muted">Алхам бүрийг дарааллаар нь. Бүгдийг дуусгавал TOPIK II-ийн дасгалууд нээгдэнэ.</p>
      </div>
      {STEPS.map((s) => {
        const open = b.unlocked[s.id];
        const p = progress[s.id];
        const body = (
          <div className={cx("flex items-center gap-3 rounded-xl p-2", open ? "hover:bg-line/40" : "opacity-50")}>
            <span className={cx("grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold", open ? "bg-accent text-white" : "bg-line text-muted")}>
              {open ? s.n : "🔒"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.title}</p>
              {open && p ? (
                <Bar className="mt-1" value={(p[0] / p[1]) * 100} tone="vocab" />
              ) : (
                <p className="text-xs text-muted">{open ? s.detail : lockNote[s.id]}</p>
              )}
            </div>
            {open && p && <span className="text-xs tabular-nums text-muted">{p[0]}/{p[1]}</span>}
          </div>
        );
        return open ? <a key={s.id} href={s.route} className="block">{body}</a> : <div key={s.id}>{body}</div>;
      })}
    </Card>
  );
}
