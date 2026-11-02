# TOPIK II Sprint

TOPIK II шалгалтад 8 долоо хоногт бэлтгэх mobile-first вэб апп. UI монгол, агуулга солонгос.

## Ажиллуулах

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY-г бөглөнө (зөвхөн бичгийн AI үнэлгээнд)
npm run dev                  # http://localhost:5173
npm test                     # SRS, төлөвлөгөө, streak-ийн тест
```

API түлхүүргүй үед бичгийн хэсэг алдааны мессеж + жишиг хариулт харуулна. Бусад бүх хэсэг офлайн ажиллана.

## Бүтэц

| Зам | Агуулга |
|---|---|
| `src/data/vocab.json` | Үгс: `ko, mn, topic, ex_ko, ex_mn`. Сэдвийг `topics`-д нэмнэ. |
| `src/data/grammar.json` | Дүрмийн хэв маяг: тайлбар, жишээ, харьцуулалт, дасгал |
| `src/data/listening.json` | Сонсгол: `script` (TTS-ээр уншина) эсвэл `audio` (mp3 зам — `public/audio/`-д) |
| `src/data/reading.json` | Уншлага: `type` = blank / main_idea / order / attitude / detail |
| `src/data/writing.json` | 51–54-р даалгавар; 53-д `chart` |
| `src/data/diagnostic.js` | Оношлох тестэд орох асуултын ID-ууд |
| `src/lib/srs.js` | SM-2 spaced repetition |
| `src/lib/plan.js` | 8 долоо хоногийн төлөвлөгөө (шалгалт хүртэлх хоногт пропорциональ) |
| `src/lib/score.js` | Түвшний босго, оноо таамаглах, магадлал |
| `server/grade.js` | Claude API-аар бичгийн үнэлгээ (dev-д Vite middleware, production-д `api/grade.js`) |

Шинэ асуулт/үг нэмэхэд зөвхөн JSON-д мөр нэмнэ — ID давхцахгүй байх ёстой (алдааны дэвтэр, SRS ID-аар холбогддог).

Явц бүхэлдээ браузерын `localStorage`-д хадгалагдана (Тохиргоо → JSON экспорт).

## Deploy

Vercel: `vercel` → Environment Variables-д `ANTHROPIC_API_KEY` нэмнэ. `api/grade.js` автоматаар serverless function болно.
