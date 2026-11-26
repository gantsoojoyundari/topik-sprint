import { useState } from "react";
import vocab from "../data/vocab.json";
import { useStore } from "../lib/store.js";
import { playClips } from "../lib/sound.js";
import { galig } from "../lib/galig.js";
import { Ko, Button, cx } from "./ui.jsx";

const byId = Object.fromEntries(vocab.words.map((w) => [w.id, w]));

/**
 * Үг бүр дээр дарж болдог өгүүлбэр. tokens: [[ko, контекст дэх утга, vocabId], ...]
 * Дарахад доороос үгийн карт гарч ирнэ (Duolingo-гийн «hover hint» шиг).
 */
export function TapSentence({ tokens, className, size = "text-2xl", highlight }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <span className={cx("flex flex-wrap items-start gap-x-2 gap-y-1", className)}>
        {tokens.map((tok, k) => (
          <button
            key={k}
            onClick={() => setOpen(tok)}
            className={cx(
              "rounded-lg border-b-2 border-dotted border-muted/60 px-0.5 text-left transition hover:bg-listening-soft",
              highlight?.[k] === true && "bg-writing-soft text-good",
              highlight?.[k] === false && "bg-reading-soft text-bad",
            )}
          >
            <Ko text={tok[0]} className={size} galigClassName="text-xs" />
          </button>
        ))}
      </span>
      {open && <WordSheet tok={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function WordSheet({ tok, onClose }) {
  const [ko, gloss, id] = tok;
  const w = byId[id];
  const learned = useStore((s) => !!s.srs?.[id]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-t-3xl border-t-2 border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ko text-3xl font-bold" lang="ko">{ko}</p>
            <p className="text-sm text-muted">{galig(ko)}</p>
          </div>
          <button
            onClick={() => (w ? playClips([`vocab/${id}`], w.ko) : null)}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-xl text-white"
            aria-label="Сонсох"
          >
            🔊
          </button>
        </div>
        <p className="mt-3 text-lg font-semibold">{gloss}</p>
        {w && (
          <div className="mt-3 rounded-2xl bg-listening-soft p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Толь бичгийн хэлбэр</span>
              <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", learned ? "bg-writing-soft text-good" : "bg-line text-muted")}>
                {learned ? "Сурсан ✓" : "Шинэ үг"}
              </span>
            </div>
            <p className="mt-1">
              <span className="ko font-semibold" lang="ko">{w.ko}</span> — {w.mn}
            </p>
            <button onClick={() => playClips([`vocab/${id}-ex`], w.ex_ko)} className="mt-2 block text-left">
              <Ko text={`🔊 ${w.ex_ko}`} className="text-base" galigClassName="text-xs" />
              <span className="block text-muted">{w.ex_mn}</span>
            </button>
          </div>
        )}
        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>Хаах</Button>
      </div>
    </div>
  );
}
