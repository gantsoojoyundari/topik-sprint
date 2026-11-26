import { useEffect, useMemo, useRef, useState } from "react";
import { useStore, update, markTask, recordAttempt, NONE } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { playClips } from "../lib/sound.js";
import { galig } from "../lib/galig.js";
import { useSentences, useStories } from "../lib/content.js";
import { ALL_ITEMS, buildItems, pickItems, norm, jamo } from "../lib/items.js";
import { TapSentence } from "../components/WordTap.jsx";
import { Finish } from "../components/Finish.jsx";
import { sfxCorrect, sfxWrong } from "../lib/sfx.js";
import { Page, Card, Button, Bar, Bow, Ko, useAutoNext, cx } from "../components/ui.jsx";

// Сонсоод бичих (диктант): Duolingo-гийн «Type what you hear».
// ⌨ утасны солонгос гараар, эсвэл 🧩 үе/үгийг дарж угсарна.
const SESSION = 8;
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

export default function Dictation() {
  const [round, setRound] = useState(0);
  const [kind, setKind] = useState("word");
  const [mode, setMode] = useState(() => localStorage.getItem("dictation-mode") ?? "tiles");
  const chooseMode = (m) => {
    setMode(m);
    try { localStorage.setItem("dictation-mode", m); } catch { /* хувийн цонх */ }
  };
  return <Round key={`${round}-${kind}`} kind={kind} setKind={setKind} mode={mode} setMode={chooseMode} onAgain={() => setRound((r) => r + 1)} />;
}

function Round({ kind, setKind, mode, setMode, onAgain }) {
  const srs = useStore((s) => s.srs);
  const done = useStore((s) => s.dictation ?? NONE);
  const sentenceList = useSentences();
  const storyList = useStories();
  const set = useMemo(() => pickItems({ kind, n: SESSION, srs, done, items: buildItems(sentenceList, storyList) }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [xp, setXp] = useState(0);

  if (finished) {
    return (
      <Page title="Сонсоод бичих" back="#/practice">
        <Finish score={score} total={set.length} note="анхны оролдлогоор зөв" xp={xp} onAgain={onAgain} />
      </Page>
    );
  }

  return (
    <Page title="Сонсоод бичих ✍️" back="#/practice">
      {i === 0 && (
        <div className="mb-3 space-y-2">
          <Toggle value={kind} onChange={setKind} options={[["word", "Үг"], ["sentence", "Өгүүлбэр"], ["mix", "Холимог"]]} />
          <Toggle value={mode} onChange={setMode} options={[["tiles", "🧩 Хэсгээр"], ["keyboard", "⌨ Гараар бичих"]]} />
        </div>
      )}
      <div className="mb-2 flex items-center justify-between text-sm tabular-nums text-muted">
        <span>{i + 1} / {set.length}</span>
        {i > 0 && (
          <button onClick={() => setMode(mode === "tiles" ? "keyboard" : "tiles")} className="rounded-full bg-line px-3 py-1 text-xs">
            {mode === "tiles" ? "⌨ Гараар бичих" : "🧩 Хэсгээр"}
          </button>
        )}
      </div>
      <Bar value={(i / set.length) * 100} tone="writing" />
      <DictItem
        key={`${set[i].id}-${mode}`}
        item={set[i]}
        mode={mode}
        onDone={(firstTry) => {
          const next = score + (firstTry ? 1 : 0);
          setScore(next);
          if (firstTry) update((s) => { (s.dictation ??= {})[set[i].id] = (s.dictation[set[i].id] ?? 0) + 1; });
          if (i + 1 < set.length) setI(i + 1);
          else {
            setXp(recordAttempt("writing", next, set.length, "dictation"));
            markTask(`${today()}:dictation`);
            setFinished(true);
          }
        }}
      />
    </Page>
  );
}

function Toggle({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-xl bg-line/60 p-1 text-sm">
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cx("flex-1 rounded-lg py-1.5", value === k ? "bg-surface font-semibold shadow" : "text-muted")}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** 🧩 горимын хэсгүүд: үг → үеүд (+ төөрөгдүүлэх үе), өгүүлбэр → үгс (+ төөрөгдүүлэх үг). */
function buildPieces(item) {
  if (item.kind === "word") {
    const syl = [...item.ko];
    const others = shuffle(ALL_ITEMS.filter((x) => x.kind === "word" && x.ko !== item.ko).flatMap((x) => [...x.ko]));
    const extra = [...new Set(others)].filter((s) => !syl.includes(s)).slice(0, Math.max(3, 6 - syl.length));
    return { sep: "", pieces: shuffle([...syl, ...extra]) };
  }
  const words = item.t.map((x) => x[0].replace(/[.?!]/g, ""));
  const others = shuffle(ALL_ITEMS.filter((x) => x.kind === "sentence").flatMap((x) => x.t.map((t) => t[0].replace(/[.?!]/g, ""))));
  const extra = [...new Set(others)].filter((w) => !words.includes(w)).slice(0, 2);
  return { sep: " ", pieces: shuffle([...words, ...extra]) };
}

function DictItem({ item, mode, onDone }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState([]); // хэсгийн индексүүд
  const [result, setResult] = useState(null); // null | "ok" | "bad"
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const input = useRef(null);
  const { sep, pieces } = useMemo(() => buildPieces(item), [item]);
  const say = (rate = 1) => playClips([item.clip], item.ko, rate);
  const answer = mode === "tiles" ? picked.map((k) => pieces[k]).join(sep) : text;

  useEffect(() => {
    const t = setTimeout(() => say(), 300);
    if (mode === "keyboard") input.current?.focus();
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoNext(result === "ok", () => onDone(tries === 1), 1800);

  function check() {
    if (!norm(answer)) return;
    const ok = norm(answer) === norm(item.ko);
    setResult(ok ? "ok" : "bad");
    (ok ? sfxCorrect : sfxWrong)();
    setTries((t) => t + 1);
    if (ok) say();
  }

  const target = [...norm(item.ko)];
  const mine = [...norm(answer)];

  return (
    <div className="mt-4 space-y-4">
      <Card className="relative flex items-center gap-4 py-6">
        <Bow className="absolute -right-2 -top-3 w-10 rotate-12" />
        <button onClick={() => say(1)} className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-2xl text-white" aria-label="Сонсох">🔊</button>
        <button onClick={() => say(0.6)} className="grid size-12 shrink-0 place-items-center rounded-full bg-line text-xl" aria-label="Удаан">🐢</button>
        <div className="min-w-0 flex-1 text-sm text-muted">
          Сонссоноо солонгосоор бич
          {hint ? (
            <p className="mt-1 text-base text-ink">{item.mn} · <span className="text-muted">{galig(item.ko)}</span></p>
          ) : (
            <button onClick={() => setHint(true)} className="mt-1 block text-xs underline">💡 Сэжүүр (утга + галиг)</button>
          )}
        </div>
      </Card>

      {mode === "keyboard" ? (
        <>
          <input
            ref={input}
            lang="ko"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={text}
            disabled={result === "ok"}
            onChange={(e) => { setText(e.target.value); setResult(null); }}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && check()}
            placeholder="여기에 쓰세요…"
            className={cx(
              "ko w-full rounded-2xl border-2 bg-surface px-4 py-4 text-2xl outline-none",
              result === "ok" ? "border-good" : result === "bad" ? "border-bad" : "border-line focus:border-accent",
            )}
          />
          <p className="text-xs text-muted">
            Утсандаа солонгос гар нэмэх: <b>Gboard → Тохиргоо → Хэл → 한국어 (2벌식)</b>, iPhone: <b>Тохиргоо → Ерөнхий → Гар → Korean</b>. 🌐 товчоор солино.
          </p>
        </>
      ) : (
        <>
          <div className={cx(
            "flex min-h-16 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-3",
            result === "ok" ? "border-good bg-writing-soft" : result === "bad" ? "border-bad bg-reading-soft" : "border-line",
          )}>
            {picked.length === 0 && <span className="self-center text-sm text-muted">Доороос сонсгосон дарааллаар нь дар</span>}
            {picked.map((k) => (
              <button key={k} disabled={result === "ok"} onClick={() => { setPicked(picked.filter((x) => x !== k)); setResult(null); }} className="ko rounded-xl border border-line bg-surface px-3 py-2 text-2xl" lang="ko">
                {pieces[k]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {pieces.map((p, k) => (
              <button
                key={k}
                disabled={picked.includes(k) || result === "ok"}
                onClick={() => { setPicked([...picked, k]); setResult(null); }}
                className={cx("ko rounded-xl border px-3 py-2 text-2xl", picked.includes(k) ? "border-line opacity-25" : "border-accent bg-surface hover:bg-writing-soft")}
                lang="ko"
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {result === "bad" && (
        <Card className="space-y-2 text-sm">
          <p className="font-medium text-bad">Бага зэрэг буруу байна — улаан үсгийг хар:</p>
          <div className="flex flex-wrap gap-1">
            {target.map((c, n) => (
              <span key={n} className={cx("ko rounded-lg px-2 py-1 text-2xl", mine[n] === c ? "bg-writing-soft text-good" : "bg-reading-soft text-bad")} lang="ko">
                {tries >= 2 || mine[n] === c ? c : "?"}
              </span>
            ))}
          </div>
          {/* Буруу үеийг үсгээр задлах: 보 = ㅂ + ㅗ */}
          {target.map((c, n) =>
            mine[n] && mine[n] !== c && tries >= 2 ? (
              <p key={n} className="text-muted">
                <span className="ko font-semibold text-ink">{c}</span> = {jamo(c).join(" + ")} · та <span className="ko">{mine[n]}</span> = {jamo(mine[n]).join(" + ")} гэж бичсэн
              </p>
            ) : null,
          )}
          {tries >= 2 && (
            <div className="rounded-xl bg-listening-soft p-2">
              <TapSentence tokens={item.t} size="text-xl" />
              <p className="mt-1 text-muted">{item.mn}</p>
            </div>
          )}
        </Card>
      )}
      {result === "ok" && (
        <div className="rounded-2xl bg-writing-soft p-3">
          <p className="font-medium text-good">Зөв! 🎀</p>
          <Ko text={item.ko} className="mt-1 text-xl" galigClassName="text-xs" />
          <p className="text-sm text-muted">{item.mn}</p>
        </div>
      )}

      {result !== "ok" &&
        (result === "bad" && tries >= 2 ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setText(""); setPicked([]); setResult(null); }}>Дахин бичих</Button>
            <Button onClick={() => onDone(false)}>Дараах →</Button>
          </div>
        ) : (
          <Button className="w-full" disabled={!norm(answer)} onClick={check}>Шалгах</Button>
        ))}
    </div>
  );
}
