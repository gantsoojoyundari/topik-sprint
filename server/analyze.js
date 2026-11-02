import Anthropic from "@anthropic-ai/sdk";

// Хэрэглэгчийн оруулсан солонгос текстийг эхлэгчид зориулж задлана:
// өгүүлбэр бүр → монгол орчуулга, богино дүрмийн тайлбар, үг бүрийн толь бичгийн хэлбэр + утга.
export const MAX_CHARS = 3000;

const WORD = {
  type: "object",
  additionalProperties: false,
  required: ["ko", "base", "mn"],
  properties: {
    ko: { type: "string", description: "Өгүүлбэрт яг бичигдсэн хэлбэр (хоосон зайгаар тусгаарлагдсан нэг хэсэг, цэг таслалгүй)" },
    base: { type: "string", description: "Толь бичгийн хэлбэр: үйл үг -다, нөхцөл/дагавар хасагдсан нэр үг" },
    mn: { type: "string", description: "Монгол утга (богино, 1–4 үг)" },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title_mn", "sentences"],
  properties: {
    title_mn: { type: "string", description: "Текстийн агуулгыг 2–5 үгээр (монголоор)" },
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ko", "mn", "note_mn", "words"],
        properties: {
          ko: { type: "string", description: "Эх өгүүлбэр, өөрчлөхгүй" },
          mn: { type: "string", description: "Байгалийн монгол орчуулга" },
          note_mn: { type: "string", description: "Эхлэгчид хэрэгтэй гол дүрэм/нөхцөл 1 өгүүлбэрээр, эсвэл хоосон" },
          words: { type: "array", items: WORD },
        },
      },
    },
  },
};

const SYSTEM = `Та монгол хүмүүст солонгос хэл заадаг багш. Сурагч бараг тэгээс эхэлж байгаа.
Оруулсан солонгос текстийг өгүүлбэр болгон хуваа (эх текстийг өөрчлөхгүй, дарааллыг хадгал).
Өгүүлбэр бүрийн words-д хоосон зайгаар тусгаарлагдсан хэсэг бүрийг дарааллаар нь оруул; цэг, таслал, асуултын тэмдгийг ko-оос хас.
Бүх тайлбар, орчуулгыг монгол кирилл үсгээр, энгийн, богино бич. Солонгос биш хэсэг (англи, тоо) байвал тэр чигээр нь үлдээ.`;

export async function analyzeText({ text }) {
  if (typeof text !== "string" || !/[가-힣]/.test(text)) {
    return { status: 400, json: { error: "Солонгос текст оруулна уу." } };
  }
  if (text.length > MAX_CHARS) {
    return { status: 413, json: { error: `Текст хэт урт байна (${text.length}/${MAX_CHARS} тэмдэгт). Хэсэгчлээд оруулна уу.` } };
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return { status: 503, json: { error: "AI тохируулагдаагүй байна: .env.local файлд ANTHROPIC_API_KEY нэмээд аппыг дахин асаана уу." } };
  }

  const client = new Anthropic();
  try {
    // Урт текстэд гаралт их болох тул stream ашиглаж, эцсийн мессежийг авна.
    const response = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: "user", content: `<text>\n${text}\n</text>` }],
      })
      .finalMessage();

    if (response.stop_reason === "refusal") {
      return { status: 422, json: { error: "AI энэ текстийг боловсруулахаас татгалзлаа." } };
    }
    if (response.stop_reason === "max_tokens") {
      return { status: 502, json: { error: "Хариу дутуу тасарлаа. Текстээ богиносгоод дахин оролдоно уу." } };
    }
    const out = response.content.find((b) => b.type === "text")?.text ?? "";
    return { status: 200, json: JSON.parse(out) };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { status: 503, json: { error: "API түлхүүр буруу байна." } };
    if (error instanceof Anthropic.RateLimitError) return { status: 429, json: { error: "Хүсэлт хэт олон байна. Хэсэг хүлээгээд дахин оролдоно уу." } };
    if (error instanceof Anthropic.APIError) return { status: 502, json: { error: `AI үйлчилгээний алдаа (${error.status}).` } };
    if (error instanceof SyntaxError) return { status: 502, json: { error: "AI-ийн хариуг уншиж чадсангүй. Дахин оролдоно уу." } };
    return { status: 500, json: { error: "Сүлжээний алдаа. Дахин оролдоно уу." } };
  }
}
