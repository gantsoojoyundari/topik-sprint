import { useEffect, useState } from "react";
import vocab from "../data/vocab.json";
import { useSession, adminCall } from "../lib/account.js";
import { useStore, update } from "../lib/store.js";
import { useExtra, setExtra, DEFAULT_CONFIG } from "../lib/content.js";
import { TapSentence } from "../components/WordTap.jsx";
import { Page, Card, Button, Empty, Pill, cx } from "../components/ui.jsx";

// Админ самбар: хэрэглэгчид · агуулга · тохиргоо. Эрхийг сервер (ADMIN_NAMES) шалгана.

export default function Admin() {
  const session = useSession();
  const [tab, setTab] = useState("settings");
  const [noStore, setNoStore] = useState(false);
  useEffect(() => {
    adminCall("content_get").catch((e) => setNoStore(e.code === "no_storage"));
  }, []);
  if (!session?.admin) {
    return (
      <Page title="Админ" back="#/settings">
        <Empty>Энэ хэсэг зөвхөн админд нээлттэй.</Empty>
      </Page>
    );
  }
  return (
    <Page title="Админ самбар" back="#/settings">
      {noStore && (
        <div className="mb-4 rounded-2xl border-2 border-bad bg-reading-soft p-3 text-sm">
          <p className="font-semibold text-bad">⚠️ Хадгалах сан (Redis) холбогдоогүй</p>
          <p className="mt-1">Тохиргоо, агуулга хадгалагдахгүй, хэрэглэгчдийн жагсаалт гарахгүй. Vercel → topik-sprint → <b>Storage → Create Database → Upstash for Redis (Free) → Connect</b> хийгээд Redeploy дарна.</p>
        </div>
      )}
      <div className="mb-4 flex gap-1 rounded-xl bg-line/60 p-1 text-sm">
        {[["settings", "⚙️ Апп тохиргоо"], ["users", "👥 Хэрэглэгчид"], ["content", "📚 Агуулга"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-lg py-2", tab === k ? "bg-surface font-semibold shadow" : "text-muted")}>
            {l}
          </button>
        ))}
      </div>
      {tab === "users" && <Users me={session.name} />}
      {tab === "content" && <Content />}
      {tab === "settings" && <AdminSettings />}
    </Page>
  );
}

// ---------------- Хэрэглэгчид ----------------

const ago = (t) => {
  if (!t) return "—";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `${m} мин өмнө`;
  if (m < 60 * 24) return `${Math.round(m / 60)} цагийн өмнө`;
  return `${Math.round(m / 1440)} өдрийн өмнө`;
};
const SOURCE = { story: "Уншлага", speaking: "Ярих", dictation: "Диктант", sentence: "Өгүүлбэр", reading: "Унших", listening: "Сонсгол", writing: "Бичих" };

function Users({ me }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function load() {
    setError(null);
    try {
      setUsers((await adminCall("admin_users")).users);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => void load(), []);

  async function act(name, action, payload, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(name);
    try {
      await adminCall(action, { name, ...payload });
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <Empty>{error}</Empty>;
  if (!users) return <Empty>Ачаалж байна…</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Нийт {users.length} хэрэглэгч · {users.filter((u) => u.updatedAt && Date.now() - u.updatedAt < 7 * 864e5).length} нь сүүлийн 7 хоногт идэвхтэй</span>
        <button onClick={load} className="underline">Шинэчлэх</button>
      </div>
      {users.map((u) => (
        <Card key={u.name} className={cx("space-y-2", busy === u.name && "opacity-50")}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">
              {u.name} {u.admin && <Pill tone="vocab">админ</Pill>}
            </p>
            <span className="text-xs text-muted">{ago(u.updatedAt)}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["Үсэг", u.letters], ["Үг", u.words], ["Уншлага", u.stories], ["Өдөр", u.activeDays]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-line/40 py-1.5">
                <div className="text-lg font-bold tabular-nums">{v}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
          {Object.keys(u.bySection).length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs">
              {Object.entries(u.bySection).map(([k, s]) => (
                <span key={k} className="rounded-full bg-listening-soft px-2 py-0.5">
                  {SOURCE[k] ?? k}: {s.total ? Math.round((s.correct / s.total) * 100) : 0}% · {s.n} удаа
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted">Бүртгүүлсэн: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"} · Сүүлд: {u.lastDay ?? "—"}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-9 text-xs"
              onClick={() => {
                const pin = prompt(`${u.name}-ийн шинэ 4–6 оронтой код:`);
                if (pin) act(u.name, "admin_set_pin", { pin });
              }}
            >
              🔑 Код солих
            </Button>
            <Button variant="outline" className="min-h-9 text-xs" onClick={() => act(u.name, "admin_reset", {}, `${u.name}-ийн TOPIK явцыг бүхэлд нь тэглэх үү? Буцаах боломжгүй.`)}>
              ↺ Явц тэглэх
            </Button>
            {u.name.toLowerCase() !== me.toLowerCase() && (
              <Button variant="outline" className="min-h-9 text-xs text-bad" onClick={() => act(u.name, "admin_delete", {}, `${u.name} аккаунтыг (TOPIK + HSK явцтай нь) бүрмөсөн устгах уу?`)}>
                🗑 Устгах
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------------- Агуулга ----------------

const allWords = vocab.words;
const clean = (t) => t.replace(/[.?!,]/g, "");

/** Солонгос үгийг үгсийн сантай тулгаж утгыг таана: 먹어요 → 먹다, 학생이에요 → 학생. */
function guess(token) {
  const t = clean(token);
  let best = null;
  for (const w of allWords) {
    const stem = w.ko.endsWith("다") ? w.ko.slice(0, -1) : w.ko;
    const hit = t.startsWith(w.ko) ? w.ko.length : stem.length >= 1 && t.startsWith(stem) ? stem.length : 0;
    if (hit && (!best || hit > best.hit)) best = { w, hit };
  }
  if (!best) return [token, "", null];
  const rest = t.slice(best.w.ko.endsWith("다") ? best.w.ko.length - 1 : best.w.ko.length);
  return [token, rest && !best.w.ko.endsWith("다") ? `${best.w.mn.toLowerCase()} + -${rest}` : best.w.mn.toLowerCase(), best.w.id];
}

const tokenize = (ko) => ko.trim().split(/\s+/).filter(Boolean).map(guess);

/** "Солонгос | монгол" мөрүүдийг задлана. */
const parseLines = (text) =>
  text
    .split("\n")
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter(([ko, mn]) => ko && mn)
    .map(([ko, mn]) => ({ mn, t: tokenize(ko) }));

function Content() {
  const extra = useExtra();
  const [mode, setMode] = useState("story");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null); // [{ mn, t }]
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save(next) {
    setSaving(true);
    setMsg(null);
    try {
      const { content } = await adminCall("content_save", { content: next });
      setExtra(content);
      return true;
    } catch (e) {
      setMsg(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    const id = `c${Date.now().toString(36)}`;
    const next =
      mode === "story"
        ? { ...extra, stories: [...extra.stories, { id, title: title.trim() || "Шинэ уншлага", sentences: draft }] }
        : {
            ...extra,
            sentences: [
              ...extra.sentences,
              ...draft.map((s, n) => ({ id: `${id}-${n}`, ko: s.t.map((x) => clean(x[0])).join(" "), mn: s.mn, words: s.t.map((x) => clean(x[0])), t: s.t.map((x) => [clean(x[0]), x[1], x[2]]) })),
            ],
          };
    if (await save(next)) {
      setDraft(null);
      setText("");
      setTitle("");
      setMsg("Нийтэллээ ✓ — бүх хэрэглэгчид харагдана.");
    }
  }

  const setGloss = (si, ti, v) => setDraft(draft.map((s, a) => (a !== si ? s : { ...s, t: s.t.map((x, b) => (b !== ti ? x : [x[0], v, x[2]])) })));

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex gap-1 rounded-xl bg-line/60 p-1 text-sm">
          {[["story", "Уншлага нэмэх"], ["sentence", "Өгүүлбэр нэмэх"]].map(([k, l]) => (
            <button key={k} onClick={() => { setMode(k); setDraft(null); }} className={cx("flex-1 rounded-lg py-1.5", mode === k ? "bg-surface font-semibold shadow" : "text-muted")}>
              {l}
            </button>
          ))}
        </div>
        {mode === "story" && (
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Гарчиг (монголоор)" className="w-full rounded-xl border border-line bg-surface px-3 py-2" />
        )}
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setDraft(null); }}
          rows={6}
          lang="ko"
          placeholder={"Мөр бүрт: солонгос | монгол\n저는 학생이에요. | Би оюутан.\n물을 마셔요. | Ус ууна."}
          className="ko w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm"
        />
        <Button variant="outline" className="w-full" disabled={!parseLines(text).length} onClick={() => setDraft(parseLines(text))}>
          Үгсийг задлах →
        </Button>
        <p className="text-xs text-muted">Үг бүрийн утгыг үгсийн сангаас автоматаар таана — доор нь засаж болно. Сангаас олдоогүй үгийг шараар тэмдэглэнэ.</p>
      </Card>

      {draft && (
        <Card className="space-y-4">
          <p className="font-semibold">Шалгаад нийтлэх</p>
          {draft.map((s, si) => (
            <div key={si} className="space-y-2 border-b border-line pb-3 last:border-0">
              <TapSentence tokens={s.t} size="text-xl" />
              <p className="text-sm text-muted">{s.mn}</p>
              <div className="grid gap-1">
                {s.t.map((tok, ti) => (
                  <label key={ti} className="flex items-center gap-2 text-sm">
                    <span className={cx("ko w-24 shrink-0 rounded px-1", !tok[2] && "bg-reading-soft")} lang="ko">{tok[0]}</span>
                    <input value={tok[1]} onChange={(e) => setGloss(si, ti, e.target.value)} placeholder="утга" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1" />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button className="w-full" disabled={saving || draft.some((s) => s.t.some((x) => !x[1].trim()))} onClick={publish}>
            {saving ? "Хадгалж байна…" : "Нийтлэх"}
          </Button>
        </Card>
      )}
      {msg && <p className="text-sm font-medium text-good">{msg}</p>}

      <Card className="space-y-2">
        <p className="font-semibold">Нэмсэн агуулга</p>
        {!extra.stories.length && !extra.sentences.length && <p className="text-sm text-muted">Одоогоор алга. Үндсэн агуулга (10 уншлага, 30 өгүүлбэр) аппад суурилагдсан.</p>}
        {extra.stories.map((s) => (
          <Row key={s.id} label={`📖 ${s.title}`} note={`${s.sentences.length} өгүүлбэр`} onDelete={() => confirm(`«${s.title}»-ийг устгах уу?`) && save({ ...extra, stories: extra.stories.filter((x) => x.id !== s.id) })} />
        ))}
        {extra.sentences.map((s) => (
          <Row key={s.id} label={<span className="ko" lang="ko">{s.ko}</span>} note={s.mn} onDelete={() => save({ ...extra, sentences: extra.sentences.filter((x) => x.id !== s.id) })} />
        ))}
      </Card>
    </div>
  );
}

function Row({ label, note, onDelete }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-line/30 p-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{label}</div>
        <div className="truncate text-xs text-muted">{note}</div>
      </div>
      <button onClick={onDelete} className="px-2 text-bad" aria-label="Устгах">🗑</button>
    </div>
  );
}

// ---------------- Апп тохиргоо (бүх хэрэглэгчид) ----------------

function AdminSettings() {
  const extra = useExtra();
  const unlockAll = useStore((s) => !!s.settings?.unlockAll);
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_CONFIG, ...(extra.config ?? {}) }));
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const { content } = await adminCall("content_save", { content: { ...extra, config: cfg } });
      setExtra(content);
      setMsg({ ok: true, text: "Хадгаллаа ✓ — бүх хэрэглэгчид дараагийн нээлтэд хүчинтэй." });
    } catch (e) {
      setMsg({ ok: false, text: e.code === "no_storage" ? "Хадгалах сан (Redis) холбогдоогүй тул хадгалагдсангүй." : e.message });
    } finally {
      setSaving(false);
    }
  }

  const num = (k, label, hint, min, max) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">
        {label}
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={cfg[k]}
        onChange={(e) => set(k, Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-right tabular-nums"
      />
    </label>
  );
  const sw = (k, label, hint, invert = false) => (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={invert ? !cfg[k] : !!cfg[k]} onChange={(e) => set(k, invert ? !e.target.checked : e.target.checked)} />
    </label>
  );

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="font-semibold">📈 Сурах хэмнэл</p>
        {num("dailyGoal", "Өдрийн XP зорилго", "Нүүр хуудасны ⚡ зорилго", 10, 500)}
        {num("newWordsPerDay", "Өдөрт шинэ үг", "Эхлэгчийн өдөр бүр үзэх шинэ үгийн тоо", 1, 50)}
        {num("listeningAt", "Энгийн сонсгол нээгдэх", "Хэдэн үг сурсны дараа", 0, 80)}
        {num("sentenceAt", "Өгүүлбэр зохиох нээгдэх", "Хэдэн үг сурсны дараа", 0, 80)}
      </Card>

      <Card className="space-y-3">
        <p className="font-semibold">🧩 Хэсгүүд</p>
        {sw("stories", "📖 Богино уншлага", "Үг дээр дарж утга, орчуулгатай")}
        {sw("speaking", "🎤 Ярих", "Микрофоноор дуудлага шалгах")}
        {sw("dictation", "✍️ Сонсоод бичих", "Диктант")}
      </Card>

      <Card className="space-y-3">
        <p className="font-semibold">📢 Бүх хэрэглэгчид</p>
        <label className="block space-y-1">
          <span className="text-sm">Мэдэгдэл (нүүр хуудасны дээр харагдана, хоосон бол нуугдана)</span>
          <textarea value={cfg.announcement} onChange={(e) => set("announcement", e.target.value)} rows={2} maxLength={300} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        </label>
        {sw("registrationClosed", "Шинэ бүртгэл нээлттэй", "Унтраавал шинэ хүн бүртгүүлж чадахгүй", true)}
      </Card>

      <Button className="w-full" disabled={saving} onClick={save}>{saving ? "Хадгалж байна…" : "Бүгдийг хадгалах"}</Button>
      {msg && <p className={cx("text-sm", msg.ok ? "text-good" : "text-bad")}>{msg.text}</p>}

      <Card className="space-y-2">
        <p className="font-semibold">🛡️ Миний аккаунт</p>
        {(() => (
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm">
              Бүх хичээлийг нээх
              <span className="block text-xs text-muted">Зөвхөн танд — түгжээг тойрно</span>
            </span>
            <input type="checkbox" className="size-5 accent-[var(--color-accent)]" checked={unlockAll} onChange={(e) => update((s) => { s.settings.unlockAll = e.target.checked; })} />
          </label>
        ))()}
      </Card>
    </div>
  );
}
