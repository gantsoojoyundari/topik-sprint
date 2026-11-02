import { useState } from "react";
import reading from "../data/reading.json";
import { PracticeSet, TypeFilter } from "../components/PracticeSet.jsx";
import { Page, Button, Card } from "../components/ui.jsx";

// Бодит шалгалт: 50 асуулт / 70 мин ≈ асуулт бүрт 84 секунд.
const SECONDS_PER_ITEM = 84;

const STRATEGY = {
  blank: "Хоосон зайн өмнөх, хойдох холбох үг (그러나, 따라서) логикийг заана.",
  main_idea: "Гол санаа ихэвчлэн сүүлийн өгүүлбэрт — 그러므로, 따라서, -아/어야 한다-г хай.",
  order: "Эхний өгүүлбэрт холбох үг, заах үг (이, 그) байхгүй. Сонголтуудаас эхлэлийг шүү.",
  attitude: "-아/어야 한다, 우려, 바람직하다 зэрэг үнэлгээний үгсийг ажигла.",
  detail: "Сонголт бүрийг эх бичвэртэй тулга — тоо, огноо, үгүйсгэлд анхаар.",
};

export default function Reading() {
  const [type, setType] = useState("all");
  const [running, setRunning] = useState(false);
  const items = reading.items.filter((x) => type === "all" || x.type === type);

  return (
    <Page title="읽기 · Унших" back={running ? undefined : "#/practice"}>
      {running ? (
        <PracticeSet items={items} section="reading" kind="reading" secondsPerItem={SECONDS_PER_ITEM} onExit={() => setRunning(false)} />
      ) : (
        <>
          <TypeFilter types={reading.types} items={reading.items} value={type} onChange={setType} section="reading" />
          <Card className="text-sm leading-relaxed">
            <p className="font-medium text-reading">Стратеги</p>
            <p className="mt-1 text-muted">
              {type === "all" ? "Асуулт бүрт ~1 мин 24 сек. Нэг асуултад гацвал алгасаад буцаж ир." : STRATEGY[type]}
            </p>
          </Card>
          <Button className="mt-4 w-full" disabled={!items.length} onClick={() => setRunning(true)}>
            {items.length} асуулт · {Math.ceil((items.length * SECONDS_PER_ITEM) / 60)} мин
          </Button>
        </>
      )}
    </Page>
  );
}
