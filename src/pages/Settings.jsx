import { useState } from "react";
import { useStore, update, resetAll, getState } from "../lib/store.js";
import { setTheme } from "../lib/theme.js";
import { today, addDays } from "../lib/dates.js";
import { Page, Card, Button, cx } from "../components/ui.jsx";
import { logout, useSession } from "../lib/account.js";

function Segmented({ value, options, onChange }) {
  return (
    <div className="flex rounded-xl bg-line p-1 text-sm">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={cx("flex-1 rounded-lg py-1.5", value === k && "bg-surface font-medium shadow-sm")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const state = useStore();
  const { profile, settings } = state;
  const [confirm, setConfirm] = useState(false);
  const session = useSession();

  const setProfile = (patch) =>
    update((s) => {
      Object.assign(s.profile, patch);
    });

  function exportData() {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `topik-sprint-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Page title="Тохиргоо" back="#/">
      <div className="space-y-3">
        <Card className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">{session?.name}</p>
            <p className="text-xs text-muted">Нэвтэрсэн хэрэглэгч</p>
          </div>
          <Button variant="outline" onClick={logout}>Гарах</Button>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium">Харагдац</p>
          <Segmented value={settings.theme} onChange={setTheme} options={[["light", "Цайвар"], ["dark", "Бараан"], ["system", "Систем"]]} />
          <p className="pt-2 text-sm font-medium">Солонгос үгийн доор кирилл галиг (жишээ нь 안녕하세요 → аннёнгхасэё)</p>
          <Segmented
            value={settings.galig !== false}
            onChange={(v) => update((s) => { s.settings.galig = v; })}
            options={[[true, "Харуулах"], [false, "Нуух"]]}
          />
        </Card>

        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Зорилтот түвшин</p>
            <Segmented value={profile.targetLevel} onChange={(v) => setProfile({ targetLevel: v })} options={[3, 4, 5, 6].map((l) => [l, `${l}`])} />
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Шалгалтын огноо</span>
            <input
              type="date"
              value={profile.examDate}
              min={addDays(profile.startDate, 7)}
              onChange={(e) => e.target.value && setProfile({ examDate: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface p-3"
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Өдөрт (минут)</p>
            <Segmented value={profile.minutesPerDay} onChange={(v) => setProfile({ minutesPerDay: v })} options={[30, 60, 90, 120, 180].map((m) => [m, `${m}`])} />
          </div>
          <p className="text-xs text-muted">Өөрчлөхөд өнөөдрөөс хойших төлөвлөгөө шууд дахин тооцогдоно.</p>
        </Card>

        <Card className="space-y-2">
          <p className="text-sm font-medium">Өгөгдөл</p>
          <p className="text-xs text-muted">Явц таны аккаунтад энэ төхөөрөмжийн браузерт хадгалагдана. Төхөөрөмж солихын өмнө экспортлоорой.</p>
          <Button variant="outline" className="w-full" onClick={exportData}>JSON экспортлох</Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              update((s) => {
                s.diagnostic = null;
              })
            }
          >
            Оношлох тестийг дахин өгөх
          </Button>
          {confirm ? (
            <div className="flex gap-2">
              <Button className="flex-1 bg-bad text-white" onClick={resetAll}>Тийм, бүгдийг устга</Button>
              <Button variant="outline" onClick={() => setConfirm(false)}>Болих</Button>
            </div>
          ) : (
            <Button variant="ghost" className="w-full text-bad" onClick={() => setConfirm(true)}>Бүх өгөгдлийг устгах</Button>
          )}
        </Card>
      </div>
    </Page>
  );
}
