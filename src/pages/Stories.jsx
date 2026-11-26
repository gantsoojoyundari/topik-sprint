import { useEffect, useRef, useState } from "react";
import { useStories } from "../lib/content.js";
import { useStore, update, markTask, recordAttempt, NONE } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { playClips } from "../lib/sound.js";
import { TapSentence } from "../components/WordTap.jsx";
import { sfxDone } from "../lib/sfx.js";
import { Page, Card, Button, Bar, Bow, cx } from "../components/ui.jsx";

// Богино уншлага: аппын үгсээр бичсэн жижиг өгүүллэг.
// Өгүүлбэр нэг нэгээр гарна → уншина (үг дээр дарвал утга) → «Дараах» → орчуулга → «Дараах» → дараагийн өгүүлбэр.

export default function Stories() {
  const stories = useStories();
  const [open, setOpen] = useState(() => new URLSearchParams(location.hash.split("?")[1]).get("id"));
  const story = stories.find((s) => s.id === open);
  return story ? <Reader key={story.id} story={story} onExit={() => setOpen(null)} /> : <List stories={stories} onOpen={setOpen} />;
}

function List({ stories, onOpen }) {
  const done = useStore((s) => s.stories ?? NONE);
  const srs = useStore((s) => s.srs);
  const finished = stories.filter((s) => done[s.id]).length;
  return (
    <Page title="Богино уншлага" back="#/practice">
      <Card className="mb-4 text-sm leading-relaxed">
        <p className="font-medium text-reading">Хэрхэн уншдаг вэ?</p>
        <p className="mt-1 text-muted">
          Өгүүлбэрийг уншаад, мэдэхгүй <b>үг дээрээ дар</b> — утга нь гарна. Дараа нь <b>«Дараах»</b> дарж орчуулгатайгаа тулга.
          Бүх үг нь аппын үгсийн сангаас.
        </p>
        <Bar className="mt-3" value={(finished / stories.length) * 100} tone="reading" />
        <p className="mt-1 text-xs tabular-nums text-muted">{finished}/{stories.length} уншсан</p>
      </Card>
      <div className="space-y-2">
        {stories.map((s, i) => {
          const ids = [...new Set(s.sentences.flatMap((x) => x.t.map((t) => t[2])))];
          const fresh = ids.filter((id) => !srs[id]).length;
          return (
            <button key={s.id} onClick={() => onOpen(s.id)} className="block w-full text-left">
              <Card className="flex items-center gap-4 hover:bg-line/40">
                <div className={cx("grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold", done[s.id] ? "bg-writing-soft text-good" : "bg-reading-soft text-reading")}>
                  {done[s.id] ? "✓" : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-muted">
                    {s.sentences.length} өгүүлбэр · {fresh ? `${fresh} шинэ үг` : "бүх үг танил"}
                  </div>
                </div>
                <span className="text-muted">›</span>
              </Card>
            </button>
          );
        })}
      </div>
    </Page>
  );
}

function Reader({ story, onExit }) {
  const [i, setI] = useState(0); // одоогийн өгүүлбэр
  const [shown, setShown] = useState(false); // орчуулга харагдаж байгаа эсэх
  const [finished, setFinished] = useState(false);
  const [slow, setSlow] = useState(false);
  const [xp, setXp] = useState(0);
  const bottom = useRef(null);
  const total = story.sentences.length;
  const sentence = story.sentences[i];
  const clip = (n) => `story/${story.id}-${n}`;
  const ko = (s) => s.t.map((x) => x[0]).join(" ");
  const say = (n = i, rate = slow ? 0.7 : 1) => playClips([clip(n)], ko(story.sentences[n]), rate);

  // Шинэ өгүүлбэр гарахад өөрөө нэг уншина.
  useEffect(() => {
    if (!finished) {
      const t = setTimeout(() => say(i), 300);
      return () => clearTimeout(t);
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [i, shown, finished]);

  function next() {
    if (!shown) return setShown(true);
    if (i + 1 < total) {
      setI(i + 1);
      setShown(false);
    } else {
      update((s) => {
        (s.stories ??= {})[story.id] = (s.stories[story.id] ?? 0) + 1;
      });
      setXp(recordAttempt("reading", total, total, "story"));
      sfxDone();
      markTask(`${today()}:stories`);
      setFinished(true);
    }
  }

  return (
    <Page title={story.title} back="#/practice" action={<button onClick={onExit} className="text-sm text-muted">Жагсаалт</button>}>
      <div className="mb-2 flex items-center justify-between text-sm tabular-nums text-muted">
        <span>{Math.min(i + 1, total)} / {total}</span>
        <button onClick={() => setSlow(!slow)} className={cx("rounded-full px-3 py-1", slow ? "bg-accent text-white" : "bg-line")}>
          🐢 Удаан
        </button>
      </div>
      <Bar value={((i + (shown ? 1 : 0)) / total) * 100} tone="reading" />

      <div className="mt-4 space-y-3">
        {/* Өмнөх өгүүлбэрүүд — жижгээр, орчуулгатай */}
        {story.sentences.slice(0, finished ? total : i).map((s, n) => (
          <Card key={n} className="py-3">
            <div className="flex items-start gap-2">
              <TapSentence tokens={s.t} size="text-lg" className="flex-1" />
              <button onClick={() => say(n)} className="text-lg" aria-label="Сонсох">🔊</button>
            </div>
            <p className="mt-1 text-sm text-muted">{s.mn}</p>
          </Card>
        ))}

        {!finished && (
          <Card className="relative border-2 border-reading py-6">
            <Bow className="absolute -right-2 -top-3 w-10 rotate-12" />
            <TapSentence tokens={sentence.t} size="text-3xl font-semibold" />
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => say()} className="grid size-11 place-items-center rounded-full bg-accent text-lg text-white" aria-label="Сонсох">🔊</button>
              <span className="text-xs text-muted">Үг дээр дарвал утга нь гарна</span>
            </div>
            <div className={cx("mt-4 rounded-xl p-3 transition", shown ? "bg-reading-soft" : "bg-line/50")}>
              {shown ? (
                <p className="text-lg font-medium">{sentence.mn}</p>
              ) : (
                <p className="text-sm text-muted">Орчуулгыг харахын өмнө өөрөө ойлгож үзээрэй…</p>
              )}
            </div>
          </Card>
        )}

        {finished && (
          <Card className="py-6 text-center">
            <Bow className="mx-auto w-14" />
            <p className="mt-2 text-xl font-bold">Уншиж дууслаа! 🎀</p>
            <p className="mt-1 inline-block rounded-full bg-reading-soft px-3 py-1 text-sm font-bold text-reading">+{xp} XP</p>
            <p className="mt-1 text-sm text-muted">Одоо бүтнээр нь сонсоод, хамт чанга уншаарай.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => playClips(story.sentences.map((_, n) => clip(n)), story.sentences.map(ko).join(" "), slow ? 0.7 : 1)}
            >
              🔊 Бүтнээр нь сонсох
            </Button>
          </Card>
        )}
      </div>

      <div ref={bottom} className="mt-4">
        {finished ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onExit}>Бусад уншлага</Button>
            <Button onClick={() => (location.hash = "#/speaking")}>Ярьж үзэх 🎤</Button>
          </div>
        ) : (
          <Button className="w-full" onClick={next}>
            {shown ? (i + 1 < total ? "Дараах өгүүлбэр →" : "Дуусгах ✓") : "Дараах · орчуулга харах"}
          </Button>
        )}
      </div>
    </Page>
  );
}
