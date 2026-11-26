import { useEffect, useRef, useState } from "react";
import vocab from "../data/vocab.json";
import { playClips, speakText } from "../lib/sound.js";
import { Ko, cx } from "./ui.jsx";

const byId = Object.fromEntries(vocab.words.map((w) => [w.id, w]));

/**
 * Үг бүр дээр дарж болдог өгүүлбэр. tokens: [[ko, контекст дэх утга, vocabId], ...]
 * Дарахад үгийн доор жижиг бөмбөлөгт утга гарч, дуудлагыг нь уншина (Duolingo-гийн hint шиг).
 * highlight: үг бүрийн зөв/буруу (ярианы үнэлгээ). active: одоо дуугарч буй үгийн индекс (караоке).
 */
export function TapSentence({ tokens, className, size = "text-2xl", highlight, active = -1 }) {
  const [open, setOpen] = useState(null);
  const root = useRef(null);

  // Гадна дарахад бөмбөлгийг хаана.
  useEffect(() => {
    if (open == null) return;
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function tap(k) {
    if (open === k) return setOpen(null);
    setOpen(k);
    const [ko, , id] = tokens[k];
    const w = byId[id];
    const plain = ko.replace(/[.?!]/g, "");
    // Үгийг өөрийг нь уншина (байгаа бол бэлэн MP3, үгүй бол TTS).
    if (w && plain === w.ko) playClips([`vocab/${id}`], w.ko);
    else speakText(plain);
  }

  return (
    <span ref={root} className={cx("flex flex-wrap items-start gap-x-2 gap-y-1", className)}>
      {tokens.map((tok, k) => {
        const w = byId[tok[2]];
        const right = k > 0 && k >= tokens.length / 2;
        return (
          <span key={k} className="relative">
            <button
              onClick={() => tap(k)}
              className={cx(
                "rounded-lg border-b-2 border-dotted border-muted/60 px-0.5 text-left transition-colors",
                open === k && "bg-listening-soft",
                active === k && "bg-accent text-white",
                active > k && "text-accent",
                highlight?.[k] === true && "bg-writing-soft text-good",
                highlight?.[k] === false && "bg-reading-soft text-bad",
              )}
            >
              <Ko text={tok[0]} className={size} galigClassName="text-xs" />
            </button>
            {open === k && (
              <span
                className={cx(
                  "absolute top-full z-30 mt-2 w-max max-w-[min(14rem,80vw)] rounded-xl bg-ink px-3 py-2 text-left text-sm font-normal leading-snug text-surface shadow-lg",
                  right ? "right-0" : "left-0",
                )}
              >
                <span className={cx("absolute -top-1.5 size-3 rotate-45 bg-ink", right ? "right-4" : "left-4")} />
                <span className="relative block font-semibold">{tok[1]}</span>
                {w && tok[0].replace(/[.?!]/g, "") !== w.ko && (
                  <span className="relative block text-xs opacity-75">
                    <span className="ko" lang="ko">{w.ko}</span> — {w.mn}
                  </span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
