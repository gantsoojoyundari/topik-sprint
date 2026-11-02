import { useEffect, useState } from "react";
import writing from "../data/writing.json";
import { update, useStore, markTask } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { Page, Card, Button, Bar, Pill, Bow, cx } from "../components/ui.jsx";

const MAX = { 51: 10, 52: 10, 53: 30, 54: 50 };
const COLS = 20; // 원고지 нэг мөрөнд 20 нүд

function draftKey(id) {
  return `topik-sprint:draft:${id}`;
}
function loadDraft(id) {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)));
  } catch {
    return null;
  }
}
function saveDraft(id, value) {
  try {
    localStorage.setItem(draftKey(id), JSON.stringify(value));
  } catch {
    /* хувийн цонх г.м. */
  }
}

/** TOPIK-ийн 원고지-д зай (space) мөн нэг нүд эзэлдэг тул зайг тоолно, мөр шилжилтийг тоолохгүй. */
export function countChars(text) {
  return text.replace(/\n/g, "").length;
}

export default function Writing() {
  const [open, setOpen] = useState(null);
  const writings = useStore((s) => s.writings);
  const task = writing.find((w) => w.id === open);

  if (task) return <Task task={task} onClose={() => setOpen(null)} />;

  return (
    <Page title="쓰기 · Бичих" back="#/practice">
      <div className="space-y-2">
        {writing.map((w) => {
          const last = [...writings].reverse().find((x) => x.id === w.id && x.result);
          return (
            <button key={w.id} onClick={() => setOpen(w.id)} className="block w-full text-left">
              <Card className="flex items-center gap-3 hover:bg-line/40">
                <div className="ko grid size-12 shrink-0 place-items-center rounded-xl bg-writing-soft text-lg font-bold text-writing">{w.task}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-sm text-muted">
                    {MAX[w.task]} оноо{w.min ? ` · ${w.min}–${w.max} үсэг` : ""}
                  </p>
                </div>
                {last && (
                  <Pill tone="writing">
                    {last.result.score}/{last.result.max}
                  </Pill>
                )}
              </Card>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        AI үнэлгээ нь TOPIK-ийн шалгуураар (내용 및 과제 수행 · 글의 전개 구조 · 언어 사용) оноо өгч, засварласан хувилбар болон монгол тайлбар
        гаргана. Бодит шалгагчийн оноотой зөрж болно — чиг хандлагаа харахад ашиглаарай.
      </p>
    </Page>
  );
}

function Chart({ chart }) {
  const max = Math.max(...chart.series.map((s) => s.value));
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <p className="ko mb-3 text-center text-sm font-semibold" lang="ko">{chart.title}</p>
      <div className="flex h-36 items-end justify-around gap-4 px-2">
        {chart.series.map((s) => (
          <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold tabular-nums">{s.value}</span>
            <div className="w-full max-w-12 rounded-t-md bg-writing" style={{ height: `${(s.value / max) * 100}px` }} />
            <span className="ko text-xs text-muted" lang="ko">{s.label}</span>
          </div>
        ))}
      </div>
      <ul className="ko mt-3 space-y-0.5 text-sm" lang="ko">
        {chart.notes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
      </ul>
    </div>
  );
}

function Wongoji({ text, cells }) {
  // Мөр шилжилтийг шинэ мөр болгож, мөрийн үлдэгдлийг хоосон нүдээр дүүргэнэ.
  const out = [];
  for (const para of text.split("\n")) {
    const chars = [...para];
    for (let i = 0; i < Math.max(1, chars.length); i += COLS) {
      const row = chars.slice(i, i + COLS);
      while (row.length < COLS) row.push("");
      out.push(...row);
    }
  }
  while (out.length < cells) out.push("");
  return (
    <div className="overflow-x-auto">
      <div className="ko grid min-w-[20rem] border-l border-t border-writing/40" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} lang="ko">
        {out.map((c, i) => (
          <div key={i} className={cx("relative grid aspect-square place-items-center border-b border-r border-writing/40 text-[13px]", (i + 1) % 100 === 0 && "bg-writing-soft")}>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}

function Task({ task, onClose }) {
  const isBlank = task.task <= 52;
  const [answer, setAnswer] = useState(() => loadDraft(task.id) ?? (isBlank ? ["", ""] : ""));
  const [view, setView] = useState("text");
  const [state, setState] = useState({ loading: false, error: null, result: null });

  useEffect(() => saveDraft(task.id, answer), [task.id, answer]);

  const text = isBlank ? task.blanks.map((b, i) => `${b}: ${answer[i]}`).join("\n") : answer;
  const n = isBlank ? 0 : countChars(answer);
  const inRange = !isBlank && n >= task.min && n <= task.max;
  const canSubmit = isBlank ? answer.every((a) => a.trim()) : n >= Math.min(50, task.min);

  async function submit() {
    // Бичээд илгээсэн бол (AI үнэлгээ ажиллахгүй байсан ч) өнөөдрийн 쓰기 даалгавар биелнэ.
    markTask(`${today()}:writing`);
    setState({ loading: true, error: null, result: null });
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.task, prompt: promptText(task), answer: text }),
      });
      const json = await res.json().catch(() => ({ error: "Серверээс буруу хариу ирлээ." }));
      if (!res.ok) throw new Error(json.error ?? `Алдаа (${res.status})`);
      setState({ loading: false, error: null, result: json });
      update((s) => {
        s.writings.push({ id: task.id, task: task.task, answer: text, result: json, at: Date.now() });
      });
    } catch (e) {
      setState({ loading: false, error: e.message, result: null });
    }
  }

  return (
    <Page title={task.title} action={<button className="text-sm text-muted" onClick={onClose}>Хаах</button>}>
      <Card className="relative space-y-3">
        <Bow className="absolute -right-2 -top-3 w-10 rotate-12" />
        <p className="ko text-[15px] font-medium leading-relaxed" lang="ko">{task.instruction}</p>
        {task.text && (
          <div className="ko whitespace-pre-line rounded-xl border border-line bg-bg p-3 text-[15px] leading-7" lang="ko">{task.text}</div>
        )}
        {task.chart && <Chart chart={task.chart} />}
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-writing">Зөвлөмж</summary>
          <p className="mt-1 leading-relaxed text-muted">{task.tips_mn}</p>
        </details>
      </Card>

      <div className="mt-4">
        {isBlank ? (
          <div className="space-y-3">
            {task.blanks.map((b, i) => (
              <label key={b} className="flex items-center gap-2">
                <span className="ko w-6 text-lg text-writing">{b}</span>
                <input
                  value={answer[i]}
                  onChange={(e) => setAnswer(answer.map((a, j) => (j === i ? e.target.value : a)))}
                  className="ko min-h-12 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-writing"
                  lang="ko"
                  placeholder="한국어로 쓰십시오"
                />
              </label>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex rounded-lg bg-line p-0.5 text-sm">
                {[["text", "Бичих"], ["grid", "원고지"]].map(([k, label]) => (
                  <button key={k} onClick={() => setView(k)} className={cx("rounded-md px-3 py-1", view === k && "bg-surface shadow-sm")}>
                    {label}
                  </button>
                ))}
              </div>
              <span className={cx("text-sm tabular-nums", inRange ? "text-good" : n > task.max ? "text-bad" : "text-muted")}>
                {n} / {task.min}–{task.max}
              </span>
            </div>
            <Bar value={(n / task.max) * 100} tone={n > task.max ? "mistakes" : "writing"} className="mb-2" />
            {view === "text" ? (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={task.task === 54 ? 16 : 9}
                className="ko w-full rounded-xl border border-line bg-surface p-3 text-[15px] leading-7 outline-none focus:border-writing"
                lang="ko"
                placeholder="여기에 답안을 쓰십시오. (문어체: -ㄴ다/-다)"
              />
            ) : (
              <Wongoji text={answer} cells={task.max} />
            )}
          </>
        )}
      </div>

      <Button className="mt-4 w-full" disabled={!canSubmit || state.loading} onClick={submit}>
        {state.loading ? "AI үнэлж байна… (30–60 сек)" : "AI-аар үнэлүүлэх"}
      </Button>

      {state.error && (
        <Card className="mt-4 border-bad/40">
          <p className="text-sm font-medium text-bad">{state.error}</p>
          {task.model && (
            <div className="mt-3 text-sm">
              <p className="font-medium">Жишиг хариулт — өөрөө харьцуулж шалгаарай:</p>
              {task.blanks.map((b, i) => (
                <p key={b} className="ko mt-1" lang="ko">
                  {b} {task.model[i]}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      {state.result && <Result result={state.result} />}
    </Page>
  );
}

function Result({ result }) {
  return (
    <div className="mt-4 space-y-3">
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">AI үнэлгээ</span>
          <span className="text-3xl font-bold tabular-nums text-writing">
            {result.score}
            <span className="text-base text-muted">/{result.max}</span>
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {result.criteria.map((c) => (
            <div key={c.name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="ko font-medium" lang="ko">{c.name}</span>
                <span className="tabular-nums text-muted">
                  {c.score}/{c.max}
                </span>
              </div>
              <Bar value={(c.score / c.max) * 100} tone="writing" />
              <p className="mt-1 text-sm leading-relaxed text-muted">{c.comment_mn}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-sm font-medium">Дүгнэлт</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{result.summary_mn}</p>
      </Card>
      {result.corrections.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Засвар</p>
          {result.corrections.map((c, i) => (
            <div key={i} className="text-sm">
              <p className="ko" lang="ko">
                <span className="text-bad line-through decoration-bad/60">{c.original}</span>
                <span className="mx-1.5 text-muted">→</span>
                <span className="font-medium text-good">{c.fixed}</span>
              </p>
              <p className="mt-0.5 text-muted">{c.why_mn}</p>
            </div>
          ))}
        </Card>
      )}
      <Card>
        <p className="text-sm font-medium">Засварласан хувилбар</p>
        <p className="ko mt-2 whitespace-pre-line text-[15px] leading-7" lang="ko">{result.corrected}</p>
      </Card>
    </div>
  );
}

function promptText(task) {
  let p = `${task.instruction}\n\n${task.text ?? ""}`;
  if (task.chart) {
    p += `\n[${task.chart.title}] ${task.chart.series.map((s) => `${s.label}: ${s.value}`).join(", ")}\n${task.chart.notes.join("\n")}`;
  }
  return p.trim();
}
