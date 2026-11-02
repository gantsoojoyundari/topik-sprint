import { useState } from "react";
import listening from "../data/listening.json";
import reading from "../data/reading.json";
import writing from "../data/writing.json";
import { update, useStore, recordAttempt, recordMistake, markTask } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { levelFor, thresholdFor } from "../lib/score.js";
import { Question } from "../components/Question.jsx";
import { countChars } from "./Writing.jsx";
import { Page, Card, Button, Bar, Clock, useCountdown, Pill, Empty, cx } from "../components/ui.jsx";

// Бодит шалгалтын бүтэц ба хугацаа (минут, асуултын тоо).
const REAL = { listening: { min: 60, n: 50 }, writing: { min: 50, n: 4 }, reading: { min: 70, n: 50 } };
const WRITING_MAX = { 51: 10, 52: 10, 53: 30, 54: 50 };

function minutesFor(section, count, real) {
  if (real) return REAL[section].min;
  return Math.max(section === "writing" ? 50 : 5, Math.ceil((REAL[section].min / REAL[section].n) * count));
}

export default function Mock() {
  const mocks = useStore((s) => s.mocks);
  const target = useStore((s) => s.profile.targetLevel);
  const [phase, setPhase] = useState("intro");
  const [real, setReal] = useState(false);
  const [answers, setAnswers] = useState({ listening: {}, reading: {}, writing: {} });
  const [result, setResult] = useState(null);

  const L = listening.items;
  const R = reading.items;
  const W = writing;

  function setAns(section, key, value) {
    setAnswers((a) => ({ ...a, [section]: { ...a[section], [key]: value } }));
  }

  async function grade() {
    setPhase("grading");
    const sectionScore = (items, ans, kind) => {
      let correct = 0;
      items.forEach((q) => {
        if (ans[q.id] === q.answer) correct++;
        else recordMistake(kind, q.id, ans[q.id] ?? null);
      });
      recordAttempt(kind, correct, items.length, "mock");
      return { correct, total: items.length, score: Math.round((correct / items.length) * 100) };
    };
    const lis = sectionScore(L, answers.listening, "listening");
    const rea = sectionScore(R, answers.reading, "reading");

    // Бичих: 4 даалгаврыг зэрэг AI-аар үнэлүүлнэ. API тохируулаагүй бол оноо null.
    const graded = await Promise.all(
      W.map(async (t) => {
        const raw = answers.writing[t.id];
        const text = Array.isArray(raw) ? t.blanks.map((b, i) => `${b}: ${raw[i] ?? ""}`).join("\n") : raw ?? "";
        if (!text.replace(/[㉠㉡:\s]/g, "")) return { id: t.id, task: t.task, score: 0, max: WRITING_MAX[t.task], empty: true };
        try {
          const res = await fetch("/api/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task: t.task, prompt: `${t.instruction}\n${t.text ?? ""}`, answer: text }),
          });
          const json = await res.json();
          if (!res.ok) return { id: t.id, task: t.task, error: json.error, max: WRITING_MAX[t.task] };
          return { id: t.id, task: t.task, score: json.score, max: json.max, result: json };
        } catch {
          return { id: t.id, task: t.task, error: "Сүлжээний алдаа", max: WRITING_MAX[t.task] };
        }
      }),
    );
    const writingOk = graded.every((g) => g.error == null);
    const wri = writingOk ? graded.reduce((s, g) => s + g.score, 0) : null;

    const total = lis.score + rea.score + (wri ?? 0);
    const r = {
      at: Date.now(),
      real,
      scores: { listening: lis.score, writing: wri, reading: rea.score },
      total: writingOk ? total : null,
      partial: writingOk ? null : lis.score + rea.score,
      level: writingOk ? levelFor(total) : null,
      writing: graded,
      writingError: graded.find((g) => g.error)?.error,
    };
    update((s) => {
      s.mocks.push({ at: r.at, scores: r.scores, total: r.total, level: r.level });
      for (const g of graded) if (g.result) s.writings.push({ id: g.id, task: g.task, answer: "", result: g.result, at: r.at });
    });
    markTask(`${today()}:mock`);
    setResult(r);
    setPhase("result");
  }

  if (phase === "intro") {
    return (
      <Page title="Жишиг шалгалт">
        <Card className="space-y-3">
          {[
            ["1교시", "듣기 + 쓰기", `${L.length} + ${W.length} даалгавар`],
            ["2교시", "읽기", `${R.length} асуулт`],
          ].map(([a, b, c]) => (
            <div key={a} className="flex items-center gap-3">
              <span className="ko w-14 text-sm font-semibold text-muted" lang="ko">{a}</span>
              <span className="ko flex-1 font-semibold" lang="ko">{b}</span>
              <span className="text-sm text-muted">{c}</span>
            </div>
          ))}
        </Card>
        <Card className="mt-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={real} onChange={(e) => setReal(e.target.checked)} className="mt-1 size-4 accent-current" />
            <span className="text-sm">
              <span className="font-medium">Бодит хугацаа (60 + 50 + 70 мин)</span>
              <span className="block text-muted">
                Унтраалттай үед асуултын тоонд тохируулсан хугацаа: {minutesFor("listening", L.length, false)} + {minutesFor("writing", W.length, false)} +{" "}
                {minutesFor("reading", R.length, false)} мин.
              </span>
            </span>
          </label>
        </Card>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Жишээ өгөгдөлтэй хувилбар: асуултын сан нэмэгдэхэд бүтэн 50/4/50 болно. Сонсголыг нэг л удаа сонсгоно. Бичгийг шалгалтын дараа AI
          үнэлнэ.
        </p>
        <Button className="mt-4 w-full" onClick={() => setPhase("listening")}>Эхлэх</Button>

        <h2 className="mb-2 mt-8 font-semibold">Өмнөх дүнгүүд</h2>
        {mocks.length === 0 ? (
          <Empty>Одоохондоо жишиг шалгалт өгөөгүй байна.</Empty>
        ) : (
          <Card className="divide-y divide-line p-0">
            {[...mocks].reverse().map((m) => (
              <div key={m.at} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted">{new Date(m.at).toLocaleDateString("mn-MN")}</span>
                <span className="tabular-nums">
                  {m.total ?? "—"} / 300 {m.level ? <Pill className="ml-2">{m.level}-р түвшин</Pill> : null}
                </span>
              </div>
            ))}
          </Card>
        )}
      </Page>
    );
  }

  if (phase === "listening") {
    return (
      <Section
        title="1교시 · 듣기"
        tone="listening"
        minutes={minutesFor("listening", L.length, real)}
        items={L}
        answers={answers.listening}
        onAnswer={(id, c) => setAns("listening", id, c)}
        onDone={() => setPhase("writing")}
        maxPlays={1}
        nextLabel="쓰기 руу шилжих"
      />
    );
  }

  if (phase === "writing") {
    return (
      <WritingSection
        minutes={minutesFor("writing", W.length, real)}
        answers={answers.writing}
        onAnswer={(id, v) => setAns("writing", id, v)}
        onDone={() => setPhase("break")}
      />
    );
  }

  if (phase === "break") {
    return (
      <Page title="Завсарлага">
        <Card className="py-10 text-center">
          <p className="ko text-lg font-semibold" lang="ko">1교시 종료</p>
          <p className="mt-2 text-muted">Бодит шалгалтад 1-р цагийн дараа ~30 мин завсарлага байдаг. Ус уугаад сунгаалт хий.</p>
          <Button className="mt-6" onClick={() => setPhase("reading")}>2교시 · 읽기 эхлэх</Button>
        </Card>
      </Page>
    );
  }

  if (phase === "reading") {
    return (
      <Section
        title="2교시 · 읽기"
        tone="reading"
        minutes={minutesFor("reading", R.length, real)}
        items={R}
        answers={answers.reading}
        onAnswer={(id, c) => setAns("reading", id, c)}
        onDone={grade}
        nextLabel="Шалгалт дуусгах"
      />
    );
  }

  if (phase === "grading") {
    return (
      <Page title="Дүн гаргаж байна">
        <Card className="py-10 text-center text-muted">Бичгийн даалгаврыг AI үнэлж байна… (~1 мин)</Card>
      </Page>
    );
  }

  return <MockResult result={result} target={target} answers={answers} onClose={() => setPhase("intro")} />;
}

function Section({ title, tone, minutes, items, answers, onAnswer, onDone, maxPlays, nextLabel }) {
  const [i, setI] = useState(0);
  const left = useCountdown(minutes * 60, onDone);
  const item = items[i];
  const answered = Object.keys(answers).length;
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className={cx("ko font-semibold", tone === "listening" ? "text-listening" : "text-reading")} lang="ko">{title}</span>
        <Clock seconds={left} warnAt={300} />
      </div>
      <Bar value={(answered / items.length) * 100} tone={tone} />
      <div className="mt-4">
        <Question key={item.id} item={item} mode="exam" number={i + 1} maxPlays={maxPlays} chosen={answers[item.id] ?? null} onChoose={(c) => onAnswer(item.id, c)} />
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" disabled={i === 0} onClick={() => setI(i - 1)}>Өмнөх</Button>
        {i < items.length - 1 ? (
          <Button className="flex-1" onClick={() => setI(i + 1)}>Дараах</Button>
        ) : (
          <Button className="flex-1" onClick={onDone}>{nextLabel}</Button>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {items.map((q, j) => (
          <button
            key={q.id}
            onClick={() => setI(j)}
            className={cx("size-8 rounded-lg text-xs tabular-nums", j === i ? "bg-ink text-bg" : answers[q.id] != null ? "bg-line" : "border border-line")}
          >
            {j + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function WritingSection({ minutes, answers, onAnswer, onDone }) {
  const left = useCountdown(minutes * 60, onDone);
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <span className="ko font-semibold text-writing" lang="ko">1교시 · 쓰기</span>
        <Clock seconds={left} warnAt={300} />
      </div>
      {writing.map((t) => {
        const val = answers[t.id] ?? (t.blanks ? ["", ""] : "");
        return (
          <Card key={t.id} className="space-y-3">
            <p className="ko text-sm font-medium" lang="ko">
              {t.task}. {t.instruction}
            </p>
            {t.text && <div className="ko whitespace-pre-line rounded-xl bg-bg p-3 text-sm leading-6" lang="ko">{t.text}</div>}
            {t.chart && (
              <p className="ko rounded-xl bg-bg p-3 text-sm" lang="ko">
                {t.chart.title}: {t.chart.series.map((s) => `${s.label} ${s.value}`).join(" → ")}
                <br />
                {t.chart.notes.join(" / ")}
              </p>
            )}
            {t.blanks ? (
              t.blanks.map((b, i) => (
                <input
                  key={b}
                  value={val[i]}
                  onChange={(e) => onAnswer(t.id, val.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={b}
                  className="ko min-h-11 w-full rounded-xl border border-line bg-surface px-3"
                  lang="ko"
                />
              ))
            ) : (
              <>
                <textarea
                  value={val}
                  onChange={(e) => onAnswer(t.id, e.target.value)}
                  rows={t.task === 54 ? 12 : 7}
                  className="ko w-full rounded-xl border border-line bg-surface p-3 leading-7"
                  lang="ko"
                />
                <p className="text-right text-xs tabular-nums text-muted">
                  {countChars(val)} / {t.min}–{t.max}
                </p>
              </>
            )}
          </Card>
        );
      })}
      <Button className="w-full" onClick={onDone}>1교시 дуусгах</Button>
    </div>
  );
}

function MockResult({ result, target, answers, onClose }) {
  const [review, setReview] = useState(null);
  const need = thresholdFor(target);

  if (review) {
    const items = review === "listening" ? listening.items : reading.items;
    return (
      <Page title={review === "listening" ? "듣기 тайлбар" : "읽기 тайлбар"} action={<button className="text-sm text-muted" onClick={() => setReview(null)}>Буцах</button>}>
        <div className="space-y-6">
          {items.map((q, i) => (
            <Card key={q.id}>
              <Question item={q} mode="review" number={i + 1} chosen={answers[review][q.id] ?? null} />
            </Card>
          ))}
        </div>
      </Page>
    );
  }

  const shown = result.total ?? result.partial;
  return (
    <Page title="Жишиг шалгалтын дүн">
      <Card className="text-center">
        <p className="text-sm text-muted">{result.total == null ? "Бичихгүйгээр (듣기 + 읽기)" : "Нийт оноо"}</p>
        <p className="mt-1 text-5xl font-bold tabular-nums">
          {shown}
          <span className="text-xl text-muted">/{result.total == null ? 200 : 300}</span>
        </p>
        <p className="mt-2 font-medium">
          {result.level ? `Тооцоолсон түвшин: ${result.level}-р түвшин` : result.total == null ? "Бичгийн оноо гараагүй" : "Түвшин тогтоогдохгүй (<120)"}
        </p>
        {result.total != null && (
          <p className={cx("mt-1 text-sm", result.total >= need ? "text-good" : "text-muted")}>
            Зорилт {target}-р түвшин ({need}+): {result.total >= need ? "хүрсэн ✓" : `${need - result.total} оноо дутуу`}
          </p>
        )}
      </Card>
      <Card className="mt-3 space-y-3">
        {[
          ["listening", "듣기"],
          ["writing", "쓰기"],
          ["reading", "읽기"],
        ].map(([k, ko]) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="ko font-medium" lang="ko">{ko}</span>
              <span className="tabular-nums text-muted">{result.scores[k] ?? "—"}/100</span>
            </div>
            <Bar value={result.scores[k] ?? 0} tone={k} />
          </div>
        ))}
        {result.writingError && <p className="text-sm text-bad">Бичгийн үнэлгээ: {result.writingError}</p>}
      </Card>
      {result.writing.some((w) => w.result) && (
        <Card className="mt-3 space-y-2 text-sm">
          <p className="font-medium">Бичгийн даалгавар</p>
          {result.writing.map((w) => (
            <div key={w.id} className="flex justify-between">
              <span>{w.task}-р даалгавар</span>
              <span className="tabular-nums text-muted">{w.error ? "—" : `${w.score}/${w.max}`}</span>
            </div>
          ))}
          <p className="text-xs text-muted">Дэлгэрэнгүй тайлбарыг «쓰기» хэсгийн даалгавар бүрээс харна.</p>
        </Card>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setReview("listening")}>듣기 тайлбар</Button>
        <Button variant="outline" onClick={() => setReview("reading")}>읽기 тайлбар</Button>
      </div>
      <Button className="mt-2 w-full" onClick={onClose}>Дуусгах</Button>
    </Page>
  );
}
