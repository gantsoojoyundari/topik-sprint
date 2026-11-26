// Нэр + 4–6 оронтой кодоор нэвтрэх аккаунт. Имэйл шаардлагагүй.
// Production-д Upstash Redis (Vercel Storage) REST API ашиглана; dev-д санах ойд хадгална.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL = 60 * 60 * 24 * 365; // 1 жил
const MAX_FAILS = 8; // ингэтэл буруу код оруулбал 15 минут түгжинэ
const LOCK_TTL = 15 * 60;
const MAX_DATA = 900_000; // байт
// topik-sprint, hsk хоёр нэг Redis санг хуваалцана: нэр+код (user:, sess:) нийтлэг, явц нь апп бүрт тусдаа.
const APP = "topik";

// ---------- Хадгалах сан ----------

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

const mem = new Map(); // dev fallback: key → { v, exp }

async function cmd(...args) {
  const env = redisEnv();
  if (env) {
    const r = await fetch(env.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  const [op, key, val] = args;
  const now = Date.now();
  const cur = mem.get(key);
  const live = cur && (!cur.exp || cur.exp > now) ? cur : null;
  switch (op) {
    case "GET":
      return live?.v ?? null;
    case "SET": {
      if (args.includes("NX") && live) return null;
      const exIdx = args.indexOf("EX");
      mem.set(key, { v: val, exp: exIdx > 0 ? now + Number(args[exIdx + 1]) * 1000 : 0 });
      return "OK";
    }
    case "DEL":
      mem.delete(key);
      return 1;
    case "INCR": {
      const n = Number(live?.v ?? 0) + 1;
      mem.set(key, { v: String(n), exp: live?.exp ?? 0 });
      return n;
    }
    case "EXPIRE":
      if (live) live.exp = now + Number(val) * 1000;
      return 1;
    case "SCAN": {
      // SCAN 0 MATCH user:* COUNT n — dev-д нэг дор бүгдийг буцаана.
      const prefix = String(args[3] ?? "*").replace(/\*$/, "");
      return ["0", [...mem.keys()].filter((k) => k.startsWith(prefix))];
    }
    default:
      throw new Error(`unsupported ${op}`);
  }
}

// ---------- Туслах ----------

export function normalizeName(name) {
  return String(name ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
}
const keyOf = (name) => normalizeName(name).toLowerCase();

function hashPin(pin, salt) {
  return scryptSync(String(pin), salt, 32).toString("hex");
}

const PIN_RE = /^\d{4,6}$/;

function validate(name, pin) {
  const n = normalizeName(name);
  if (n.length < 2 || n.length > 24) return "Хэрэглэгчийн нэр 2–24 тэмдэгт байна.";
  if (!PIN_RE.test(String(pin ?? ""))) return "Код 4–6 оронтой тоо байна.";
  return null;
}

async function newSession(key) {
  const token = randomBytes(24).toString("base64url");
  await cmd("SET", `sess:${token}`, key, "EX", SESSION_TTL);
  return token;
}

async function userFromToken(token) {
  if (!token || typeof token !== "string") return null;
  if (token.startsWith("adm.")) return verifyAdmin(token);
  return cmd("GET", `sess:${token}`);
}

async function readData(key) {
  const raw = await cmd("GET", `data:${APP}:${key}`);
  return raw ? JSON.parse(raw) : null;
}

// Админ: ADMIN_NAMES=нэр1,нэр2 (Vercel env / .env.local). Клиент өөрөө админ болж чадахгүй.
const adminKeys = () =>
  (process.env.ADMIN_NAMES ?? "")
    .split(",")
    .map((s) => keyOf(s))
    .filter(Boolean);
const adminPin = () => String(process.env.ADMIN_PIN ?? "").trim();
export const isAdmin = (key) => !!key && adminKeys().includes(key);

async function allUserKeys() {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await cmd("SCAN", cursor, "MATCH", "user:*", "COUNT", 500);
    keys.push(...batch.map((k) => k.slice(5)));
    cursor = String(next);
  } while (cursor !== "0");
  return [...new Set(keys)];
}

/** Хэрэглэгчийн явцын товч: админы жагсаалтад. */
function summarize(user, data) {
  const days = Object.keys(data?.log ?? {}).sort();
  const attempts = data?.attempts ?? [];
  const bySection = {};
  for (const a of attempts) {
    const s = (bySection[a.source || a.section] ??= { correct: 0, total: 0, n: 0 });
    s.correct += a.correct ?? 0;
    s.total += a.total ?? 0;
    s.n++;
  }
  return {
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: data?.updatedAt ?? null,
    words: Object.keys(data?.srs ?? {}).length,
    letters: Object.values(data?.hangul ?? {}).filter((n) => n >= 2).length,
    stories: Object.keys(data?.stories ?? {}).length,
    activeDays: days.length,
    lastDay: days.at(-1) ?? null,
    bySection,
    admin: isAdmin(keyOf(user.name)),
  };
}

const ok = (json) => ({ status: 200, json });
const err = (status, error, extra) => ({ status, json: { error, ...extra } });

// ---------- Үйлдлүүд ----------

// ---------- Хадгалах сангүй үеийн админ нэвтрэлт ----------
// Админ нэр, код нь env-д байгаа тул санд хадгалахгүйгээр шалгаж, гарын үсэгтэй токен олгоно.
// Ингэснээр Redis холбогдоогүй ч админ ямар ч төхөөрөмжөөс нэвтэрнэ.
const adminSecret = () => `${process.env.ADMIN_SECRET ?? ""}|${adminPin()}|${process.env.ADMIN_NAMES ?? ""}|topik-admin`;
function signAdmin(key) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  const payload = `${Buffer.from(key).toString("base64url")}.${exp}`;
  return `adm.${payload}.${createHmac("sha256", adminSecret()).update(payload).digest("base64url")}`;
}
function verifyAdmin(token) {
  const [tag, k, exp, sig] = String(token ?? "").split(".");
  if (tag !== "adm" || !k || !exp || !sig || !adminPin()) return null;
  const want = createHmac("sha256", adminSecret()).update(`${k}.${exp}`).digest("base64url");
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const key = Buffer.from(k, "base64url").toString();
  return isAdmin(key) ? key : null;
}

export async function handleAccount(body = {}, authHeader = "") {
  const token = authHeader.replace(/^Bearer\s+/i, "") || body.token;
  if (!redisEnv() && process.env.VERCEL) {
    const key = keyOf(body.name);
    const adminLogin =
      (body.action === "login" || body.action === "register") && isAdmin(key) && adminPin() && String(body.pin) === adminPin();
    if (adminLogin) return ok({ token: signAdmin(key), name: key, data: null, admin: true });
    if (body.action === "load" && verifyAdmin(token)) return ok({ data: null, admin: true });
    if (body.action === "logout") return ok({ ok: true });
    return err(503, "Сервер дээр хадгалах сан холбогдоогүй байна.", { code: "no_storage" });
  }
  try {
    switch (body.action) {
      case "register": {
        const bad = validate(body.name, body.pin);
        if (bad) return err(400, bad);
        const name = normalizeName(body.name);
        const key = keyOf(name);
        if (isAdmin(key)) {
          // Админ нэрийг өөр хүн бүртгүүлж чадахгүй — зөвхөн ADMIN_PIN-ээр нэвтэрнэ.
          if (!adminPin() || String(body.pin) !== adminPin()) return err(403, "Энэ нэрийг бүртгүүлэх боломжгүй.", { code: "reserved" });
          return handleAccount({ ...body, action: "login" }, authHeader);
        }
        const salt = randomBytes(16).toString("hex");
        const user = { name, salt, hash: hashPin(body.pin, salt), createdAt: Date.now() };
        const created = await cmd("SET", `user:${key}`, JSON.stringify(user), "NX");
        if (!created) return err(409, "Энэ нэр аль хэдийн бүртгэлтэй байна. Өөр нэр сонгох эсвэл «Нэвтрэх»-ээр орно уу.", { code: "taken" });
        const data = body.data && typeof body.data === "object" ? body.data : null;
        if (data) await cmd("SET", `data:${APP}:${key}`, JSON.stringify(data));
        return ok({ token: await newSession(key), name, data, admin: isAdmin(key) });
      }

      case "login": {
        const bad = validate(body.name, body.pin);
        if (bad) return err(400, bad);
        const key = keyOf(body.name);
        const fails = Number((await cmd("GET", `fail:${key}`)) ?? 0);
        if (fails >= MAX_FAILS) return err(429, "Хэт олон удаа буруу код орууллаа. 15 минутын дараа дахин оролдоно уу.");
        const raw = await cmd("GET", `user:${key}`);
        // Админ: ADMIN_PIN-ээр нэвтэрвэл (аккаунт байхгүй бол үүсгээд) шууд оруулна.
        if (isAdmin(key) && adminPin() && String(body.pin) === adminPin()) {
          const prev = { ...(raw ? JSON.parse(raw) : { createdAt: Date.now() }), name: key };
          const salt = randomBytes(16).toString("hex");
          await cmd("SET", `user:${key}`, JSON.stringify({ ...prev, salt, hash: hashPin(body.pin, salt) }));
          await cmd("DEL", `fail:${key}`);
          return ok({ token: await newSession(key), name: prev.name, data: await readData(key), admin: true });
        }
        const user = raw ? JSON.parse(raw) : null;
        if (!user) return err(404, "Ийм нэртэй хэрэглэгч алга. «Бүртгүүлэх»-ээр шинээр үүсгэнэ үү.", { code: "no_user" });
        const match = timingSafeEqual(Buffer.from(hashPin(body.pin, user.salt), "hex"), Buffer.from(user.hash, "hex"));
        if (!match) {
          await cmd("INCR", `fail:${key}`);
          await cmd("EXPIRE", `fail:${key}`, LOCK_TTL);
          return err(401, "Код буруу байна.");
        }
        await cmd("DEL", `fail:${key}`);
        return ok({ token: await newSession(key), name: user.name, data: await readData(key), admin: isAdmin(key) });
      }

      case "load": {
        const key = await userFromToken(token);
        if (!key) return err(401, "Нэвтрэх хугацаа дууссан.");
        return ok({ data: await readData(key), admin: isAdmin(key) });
      }

      // ---------- Нэмэлт агуулга (админ нэмсэн уншлага, өгүүлбэр) — хүн бүр уншина ----------
      case "content_get": {
        const raw = await cmd("GET", `content:${APP}`);
        return ok({ content: raw ? JSON.parse(raw) : { stories: [], sentences: [] } });
      }

      // ---------- Админ ----------
      case "admin_users":
      case "admin_set_pin":
      case "admin_reset":
      case "admin_delete":
      case "content_save": {
        const me = await userFromToken(token);
        if (!isAdmin(me)) return err(403, "Зөвхөн админ хийнэ.");

        if (body.action === "content_save") {
          const c = body.content ?? {};
          const clean = { stories: Array.isArray(c.stories) ? c.stories : [], sentences: Array.isArray(c.sentences) ? c.sentences : [], updatedAt: Date.now() };
          const raw = JSON.stringify(clean);
          if (raw.length > MAX_DATA) return err(413, "Агуулга хэт том байна.");
          await cmd("SET", `content:${APP}`, raw);
          return ok({ content: clean });
        }

        if (body.action === "admin_users") {
          const users = [];
          for (const k of await allUserKeys()) {
            const raw = await cmd("GET", `user:${k}`);
            if (!raw) continue;
            users.push(summarize(JSON.parse(raw), await readData(k)));
          }
          users.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
          return ok({ users });
        }

        const target = keyOf(body.name);
        const raw = await cmd("GET", `user:${target}`);
        if (!raw) return err(404, "Хэрэглэгч олдсонгүй.");
        const user = JSON.parse(raw);

        if (body.action === "admin_set_pin") {
          if (!PIN_RE.test(String(body.pin ?? ""))) return err(400, "Код 4–6 оронтой тоо байна.");
          user.salt = randomBytes(16).toString("hex");
          user.hash = hashPin(body.pin, user.salt);
          await cmd("SET", `user:${target}`, JSON.stringify(user));
          await cmd("DEL", `fail:${target}`);
          return ok({ ok: true });
        }
        if (body.action === "admin_reset") {
          await cmd("DEL", `data:${APP}:${target}`);
          return ok({ ok: true });
        }
        if (body.action === "admin_delete") {
          if (target === me) return err(400, "Өөрийгөө устгах боломжгүй.");
          for (const k of [`user:${target}`, `data:topik:${target}`, `data:hsk:${target}`, `fail:${target}`]) await cmd("DEL", k);
          return ok({ ok: true });
        }
        return err(400, "Үйлдэл тодорхойгүй.");
      }

      case "save": {
        const key = await userFromToken(token);
        if (!key) return err(401, "Нэвтрэх хугацаа дууссан.");
        const raw = JSON.stringify(body.data ?? null);
        if (raw.length > MAX_DATA) return err(413, "Өгөгдөл хэт том байна.");
        await cmd("SET", `data:${APP}:${key}`, raw);
        return ok({ saved: true });
      }

      case "delete": {
        const key = await userFromToken(token);
        if (!key) return err(401, "Нэвтрэх хугацаа дууссан.");
        const raw = await cmd("GET", `user:${key}`);
        const user = raw ? JSON.parse(raw) : null;
        if (!user || !PIN_RE.test(String(body.pin ?? ""))) return err(401, "Код буруу байна.");
        const match = timingSafeEqual(Buffer.from(hashPin(body.pin, user.salt), "hex"), Buffer.from(user.hash, "hex"));
        if (!match) return err(401, "Код буруу байна.", { code: "bad_pin" });
        // Аккаунт хоёр апп-д нийтлэг тул хоёр апп-ын явцыг хамт устгана.
        for (const k of [`user:${key}`, "data:topik:" + key, "data:hsk:" + key, `sess:${token}`]) await cmd("DEL", k);
        return ok({ deleted: true });
      }

      case "change_pin": {
        const key = await userFromToken(token);
        if (!key) return err(401, "Нэвтрэх хугацаа дууссан.");
        if (isAdmin(key)) return err(400, "Админы кодыг Vercel-ийн ADMIN_PIN тохиргооноос солино.", { code: "admin_pin" });
        if (!PIN_RE.test(String(body.pin ?? ""))) return err(400, "Шинэ код 4–6 оронтой тоо байна.");
        const raw = await cmd("GET", `user:${key}`);
        const user = raw ? JSON.parse(raw) : null;
        if (!user) return err(404, "Хэрэглэгч олдсонгүй.");
        const match = timingSafeEqual(Buffer.from(hashPin(body.oldPin ?? "", user.salt), "hex"), Buffer.from(user.hash, "hex"));
        if (!match) return err(401, "Одоогийн код буруу байна.", { code: "bad_pin" });
        user.salt = randomBytes(16).toString("hex");
        user.hash = hashPin(body.pin, user.salt);
        await cmd("SET", `user:${key}`, JSON.stringify(user));
        return ok({ ok: true });
      }

      case "logout": {
        if (token) await cmd("DEL", `sess:${token}`);
        return ok({ ok: true });
      }

      default:
        return err(400, "Үйлдэл тодорхойгүй.");
    }
  } catch (e) {
    console.error("account error", e);
    return err(500, "Серверийн алдаа. Дахин оролдоно уу.");
  }
}
