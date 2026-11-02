import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { gradeWriting } from "./server/grade.js";
import { analyzeText } from "./server/analyze.js";
import { synthesize } from "./server/tts.js";

// Dev-д /api/* -г Vite өөрөө үйлчилнэ; production-д api/*.js (Vercel function) ажиллана.
function devApi() {
  async function readJson(req) {
    let body = "";
    for await (const chunk of req) body += chunk;
    return JSON.parse(body || "{}");
  }
  function send(res, { status, json }) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(json));
  }
  return {
    name: "topik-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/grade", async (req, res) => {
        if (req.method !== "POST") return ((res.statusCode = 405), res.end());
        send(res, await gradeWriting(await readJson(req)));
      });
      server.middlewares.use("/api/analyze", async (req, res) => {
        if (req.method !== "POST") return ((res.statusCode = 405), res.end());
        send(res, await analyzeText(await readJson(req)));
      });
      server.middlewares.use("/api/tts", async (req, res) => {
        const q = new URL(req.url, "http://x").searchParams;
        const buf = await synthesize(q.get("text") ?? "", q.get("v") ?? "f").catch(() => null);
        if (!buf) return ((res.statusCode = 404), res.end());
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.end(buf);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env.local доторх ANTHROPIC_API_KEY-г зөвхөн сервер талд (middleware) ашиглана — client bundle-д орохгүй.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["ANTHROPIC_API_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }
  return { plugins: [react(), tailwindcss(), devApi()] };
});
