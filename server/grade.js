import Anthropic from "@anthropic-ai/sdk";

// TOPIK II 쓰기 оноо: 51, 52 → 10 оноо; 53 → 30; 54 → 50.
export const MAX_SCORE = { 51: 10, 52: 10, 53: 30, 54: 50 };

const CRITERIA = {
  51: "빈칸 ㉠, ㉡ 각각 5점. 문맥에 맞는 내용인가, 문장 형태(문어체/구어체, 높임법)가 앞뒤와 맞는가.",
  52: "빈칸 ㉠, ㉡ 각각 5점. 문맥 논리(대조·인과 등)에 맞는가, 문어체(-ㄴ다/-다) 종결이 맞는가.",
  53: "내용 및 과제 수행 7점 / 글의 전개 구조 7점 / 언어 사용 16점(문법·어휘의 다양성과 정확성, 문어체). 200~300자, 자료의 모든 정보를 빠짐없이 정확히 서술했는가. 개인 의견을 넣으면 감점.",
  54: "내용 및 과제 수행 12점 / 글의 전개 구조 12점 / 언어 사용 26점(중급~고급 문법과 어휘의 다양성·정확성, 문어체). 600~700자, 제시된 과제를 모두 다루었는가, 서론-본론-결론 구조와 담화 표지가 적절한가.",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "criteria", "corrected", "summary_mn", "corrections"],
  properties: {
    score: { type: "integer", description: "Нийт оноо" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "max", "comment_mn"],
        properties: {
          name: { type: "string", description: "Шалгуурын нэр (солонгосоор)" },
          score: { type: "integer" },
          max: { type: "integer" },
          comment_mn: { type: "string" },
        },
      },
    },
    corrected: { type: "string", description: "Засварласан хувилбар (солонгосоор)" },
    summary_mn: { type: "string", description: "Ерөнхий дүгнэлт, дараагийн алхам (монголоор)" },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "fixed", "why_mn"],
        properties: {
          original: { type: "string" },
          fixed: { type: "string" },
          why_mn: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `당신은 TOPIK II 쓰기 채점 위원입니다. 공식 채점 기준을 엄격하고 일관되게 적용하세요. 후하게 주지 마세요.
학습자는 몽골인이며 3~4급을 목표로 합니다. 피드백(comment_mn, summary_mn, why_mn)은 반드시 몽골어 키릴 문자로, 짧고 구체적으로 쓰세요.
corrected는 학습자의 원래 내용과 구조를 최대한 살리면서 문법·어휘·문어체를 고친 한국어 답안입니다(새 글을 쓰지 마세요).
corrections에는 가장 중요한 오류를 최대 8개까지 넣으세요.
criteria의 max 합계는 문항 만점과 같아야 하고, score는 criteria score의 합이어야 합니다.`;

export async function gradeWriting({ task, prompt, answer }) {
  const max = MAX_SCORE[task];
  if (!max || typeof answer !== "string" || !answer.trim()) {
    return { status: 400, json: { error: "task (51–54) болон answer шаардлагатай." } };
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return {
      status: 503,
      json: { error: "AI үнэлгээ тохируулагдаагүй байна: .env.local файлд ANTHROPIC_API_KEY нэмнэ үү." },
    };
  }

  const client = new Anthropic();
  const user = `문항: ${task}번 (만점 ${max}점)
채점 기준: ${CRITERIA[task]}

<문제>
${prompt}
</문제>

<학습자_답안 글자수="${answer.replace(/\s/g, "").length}">
${answer}
</학습자_답안>`;

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      return { status: 422, json: { error: "AI энэ хариултыг үнэлэхээс татгалзлаа. Текстээ шалгаад дахин оролдоно уу." } };
    }
    if (response.stop_reason === "max_tokens") {
      return { status: 502, json: { error: "AI-ийн хариу дутуу тасарлаа. Дахин оролдоно уу." } };
    }
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const result = JSON.parse(text);
    result.score = Math.max(0, Math.min(max, result.score));
    return { status: 200, json: { ...result, max } };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: 503, json: { error: "API түлхүүр буруу байна." } };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { status: 429, json: { error: "Хүсэлт хэт олон байна. Хэсэг хүлээгээд дахин оролдоно уу." } };
    }
    if (error instanceof Anthropic.APIError) {
      return { status: 502, json: { error: `AI үйлчилгээний алдаа (${error.status}).` } };
    }
    if (error instanceof SyntaxError) {
      return { status: 502, json: { error: "AI-ийн хариуг уншиж чадсангүй. Дахин оролдоно уу." } };
    }
    return { status: 500, json: { error: "Сүлжээний алдаа. Дахин оролдоно уу." } };
  }
}
