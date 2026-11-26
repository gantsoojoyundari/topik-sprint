import { useEffect } from "react";
import { useStore, DAILY_GOAL } from "../lib/store.js";
import { today } from "../lib/dates.js";
import { sfxDone } from "../lib/sfx.js";
import { Card, Button, Bow, Bar } from "./ui.jsx";

/** Duolingo шиг дуусгах дэлгэц: оноо, +XP, өдрийн зорилго, streak. */
export function Finish({ score, total, note = "зөв", xp, onAgain }) {
  const todayXp = useStore((s) => s.log?.[today()]?.xp ?? 0);
  useEffect(() => sfxDone(), []);
  const pct = total ? score / total : 1;
  const title = pct === 1 ? "Төгс! 🏆" : pct >= 0.7 ? "Гайхалтай! 🎉" : "Сайн байна! 💪";
  return (
    <Card className="py-8 text-center">
      <Bow className="mx-auto w-16" />
      <p className="mt-3 text-2xl font-bold">{title}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-good p-3">
          <div className="text-xs font-semibold uppercase text-good">Оноо</div>
          <div className="text-3xl font-bold tabular-nums">{score}/{total}</div>
          <div className="text-xs text-muted">{note}</div>
        </div>
        <div className="rounded-2xl border-2 border-reading p-3">
          <div className="text-xs font-semibold uppercase text-reading">XP</div>
          <div className="text-3xl font-bold tabular-nums">+{xp ?? 0}</div>
          <div className="text-xs text-muted">энэ дасгалд</div>
        </div>
      </div>
      <div className="mt-4 text-left">
        <div className="mb-1 flex justify-between text-sm">
          <span className="font-medium">Өдрийн зорилго</span>
          <span className="tabular-nums text-muted">{Math.min(todayXp, DAILY_GOAL)}/{DAILY_GOAL} XP {todayXp >= DAILY_GOAL && "✓"}</span>
        </div>
        <Bar value={(todayXp / DAILY_GOAL) * 100} tone="reading" />
      </div>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={() => (location.hash = "#/")}>Нүүр хуудас</Button>
        {onAgain && <Button onClick={onAgain}>Дахиад ↻</Button>}
      </div>
    </Card>
  );
}
