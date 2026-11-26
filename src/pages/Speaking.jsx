import { useEffect, useMemo, useState } from "react";
import { useStore, update, markTask, recordAttempt, NONE } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { playClips } from "../lib/sound.js";
import { useSentences, useStories } from "../lib/content.js";
import { buildItems, pickItems, similarity, tokenHits } from "../lib/items.js";
import { canRecognize, canRecord, useRecognizer, useRecorder } from "../lib/voice.js";
import { TapSentence } from "../components/WordTap.jsx";
import { Finish } from "../components/Finish.jsx";
import { sfxCorrect, sfxWrong } from "../lib/sfx.js";
import { Page, Card, Button, Bar, Bow, useAutoNext, cx } from "../components/ui.jsx";

// Ярих: Duolingo-гийн «Speak this» шиг — сонсоно → микрофонд хэлнэ → үг бүрийг ногоон/улаанаар үнэлнэ.
const SESSION = 8;
const PASS = 0.75;

export default function Speaking() {
  const [round, setRound] = useState(0);
  const [kind, setKind] = useState("mix");
  return <Round key={`${round}-${kind}`} kind={kind} setKind={setKind} onAgain={() => setRound((r) => r + 1)} />;
}

function Round({ kind, setKind, onAgain }) {
  const srs = useStore((s) => s.srs);
  const done = useStore((s) => s.speaking ?? NONE);
  const sentenceList = useSentences();
  const storyList = useStories();
  const set = useMemo(() => pickItems({ kind, n: SESSION, srs, done, items: buildItems(sentenceList, storyList) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [xp, setXp] = useState(0);

  if (finished) {
    return (
      <Page title="Ярих" back="#/practice">
        <Finish score={score} total={set.length} note="зөв дуудсан" xp={xp} onAgain={onAgain} />
      </Page>
    );
  }

  return (
    <Page title="Ярих 🎤" back="#/practice">
      {i === 0 && (
        <div className="mb-3 flex gap-1 rounded-xl bg-line/60 p-1 text-sm">
          {[["mix", "Холимог"], ["word", "Үг"], ["sentence", "Өгүүлбэр"]].map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={cx("flex-1 rounded-lg py-1.5", kind === k ? "bg-surface font-semibold shadow" : "text-muted")}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 text-sm tabular-nums text-muted">{i + 1} / {set.length}</div>
      <Bar value={(i / set.length) * 100} tone="listening" />
      <SpeakItem
        key={set[i].id}
        item={set[i]}
        onDone={(ok) => {
          const next = score + (ok ? 1 : 0);
          setScore(next);
          if (ok) update((s) => { (s.speaking ??= {})[set[i].id] = (s.speaking[set[i].id] ?? 0) + 1; });
          if (i + 1 < set.length) setI(i + 1);
          else {
            setXp(recordAttempt("listening", next, set.length, "speaking"));
            markTask(`${today()}:speaking`);
            setFinished(true);
          }
        }}
      />
    </Page>
  );
}

function SpeakItem({ item, onDone }) {
  const [result, setResult] = useState(null); // { said, hits, sim, ok }
  const [tries, setTries] = useState(0);
  const [slow, setSlow] = useState(false);
  const say = (rate = slow ? 0.7 : 1) => playClips([item.clip], item.ko, rate);
  const rec = useRecorder();

  const recog = useRecognizer((alts) => {
    if (!alts.length) return;
    // Хэд хэдэн хувилбараас хамгийн ойрыг нь авна.
    const best = alts.map((a) => ({ said: a, sim: similarity(a, item.ko) })).sort((a, b) => b.sim - a.sim)[0];
    const hits = tokenHits(item.t, best.said);
    const ok = best.sim >= PASS || hits.every(Boolean);
    setResult({ ...best, hits, ok });
    (ok ? sfxCorrect : sfxWrong)();
    setTries((t) => t + 1);
  });

  useEffect(() => {
    const t = setTimeout(() => say(), 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoNext(!!result?.ok, () => onDone(tries === 1), 1600);

  return (
    <div className="mt-4 space-y-4">
      <Card className="relative">
        <Bow className="absolute -right-2 -top-3 w-10 rotate-12" />
        <p className="text-sm text-muted">Сонсоод, чангаар давтаж хэл:</p>
        <div className="mt-3 flex items-start gap-3">
          <div className="flex flex-col gap-2">
            <button onClick={() => say(1)} className="grid size-12 place-items-center rounded-full bg-accent text-xl text-white" aria-label="Сонсох">🔊</button>
            <button onClick={() => { setSlow(true); say(0.7); }} className="grid size-12 place-items-center rounded-full bg-line text-xl" aria-label="Удаан сонсох">🐢</button>
          </div>
          <div className="min-w-0 flex-1">
            <TapSentence tokens={item.t} size="text-2xl font-semibold" highlight={result?.hits} />
            <p className="mt-2 text-muted">{item.mn}</p>
          </div>
        </div>
      </Card>

      {canRecognize ? (
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            onClick={recog.listening ? recog.stop : recog.start}
            disabled={!!result?.ok}
            className={cx(
              "grid size-24 place-items-center rounded-full text-4xl text-white shadow-lg transition",
              recog.listening ? "animate-pulse bg-bad" : "bg-accent hover:scale-105",
            )}
            aria-label="Ярих"
          >
            🎤
          </button>
          <p className="h-6 text-sm text-muted">
            {recog.listening ? (recog.interim || "Сонсож байна… хэлээрэй") : result ? "" : "Дараад хэлээрэй"}
          </p>
          {recog.error === "mic" && <p className="text-sm text-bad">Микрофоны зөвшөөрөл өгөөрэй (хаягийн мөрний 🔒 дүрс).</p>}
          {recog.error === "silence" && <p className="text-sm text-bad">Дуу сонсогдсонгүй — илүү чанга, ойрхон хэлээрэй.</p>}
        </div>
      ) : (
        <SelfCheck rec={rec} say={say} onDone={onDone} />
      )}

      {result && (
        <div className={cx("rounded-2xl p-3", result.ok ? "bg-writing-soft" : "bg-reading-soft")}>
          <p className={cx("font-semibold", result.ok ? "text-good" : "text-bad")}>
            {result.ok ? (result.sim > 0.95 ? "Төгс! 🎀" : "Сайн байна! 🎀") : "Бага зэрэг өөр сонсогдлоо"}
            <span className="ml-2 text-sm font-normal tabular-nums text-muted">{Math.round(result.sim * 100)}%</span>
          </p>
          <p className="mt-1 text-sm">
            Таны хэлсэн: <span className="ko" lang="ko">{result.said}</span>
          </p>
          {!result.ok && <p className="mt-1 text-xs text-muted">Улаан үгсийг 🐢 удаанаар сонсоод дахин хэлээрэй.</p>}
        </div>
      )}

      {canRecognize && canRecord && (
        <button onClick={rec.toggle} className="mx-auto block text-sm text-muted underline">
          {rec.recording ? "⏹ Бичлэг зогсоох" : "🎙 Өөрийн дуугаа бичиж сонсох"}
        </button>
      )}
      {rec.url && canRecognize && (
        <div className="flex justify-center gap-2 text-sm">
          <Button variant="outline" onClick={() => new Audio(rec.url).play()}>▶ Миний дуу</Button>
          <Button variant="outline" onClick={() => say(1)}>▶ Жинхэнэ</Button>
        </div>
      )}

      {result && !result.ok && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onDone(false)}>{tries >= 2 ? "Дараах →" : "Алгасах"}</Button>
          <Button onClick={() => { setResult(null); recog.start(); }}>Дахин хэлэх 🎤</Button>
        </div>
      )}
      {!result && (
        <button onClick={() => onDone(false)} className="mx-auto block text-xs text-muted">Одоо ярих боломжгүй — алгасах</button>
      )}
    </div>
  );
}

/** Яриа таних боломжгүй браузерт: бичээд, жинхэнэтэй харьцуулж, өөрөө үнэлнэ. */
function SelfCheck({ rec, say, onDone }) {
  if (!canRecord) {
    return (
      <Card className="text-sm text-muted">
        Энэ браузер микрофон дэмжихгүй байна. Chrome эсвэл Safari-аар нээгээрэй. Одоохондоо чангаар хэлээд өөрөө үнэлээрэй.
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onDone(false)}>Дахиад хэрэгтэй</Button>
          <Button onClick={() => onDone(true)}>Сайн хэлсэн ✓</Button>
        </div>
      </Card>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <button
        onClick={rec.toggle}
        className={cx("grid size-24 place-items-center rounded-full text-4xl text-white shadow-lg", rec.recording ? "animate-pulse bg-bad" : "bg-accent")}
      >
        {rec.recording ? "⏹" : "🎙"}
      </button>
      <p className="text-sm text-muted">{rec.recording ? "Бичиж байна… дуусвал дар" : "Дараад хэлээрэй — дараа нь өөрийн дууг сонсоно"}</p>
      {rec.url && (
        <>
          <div className="flex gap-2 text-sm">
            <Button variant="outline" onClick={() => new Audio(rec.url).play()}>▶ Миний дуу</Button>
            <Button variant="outline" onClick={() => say(1)}>▶ Жинхэнэ</Button>
          </div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { rec.reset(); }}>Дахин бичих</Button>
            <Button onClick={() => onDone(true)}>Ижил сонсогдлоо ✓</Button>
          </div>
        </>
      )}
    </div>
  );
}
