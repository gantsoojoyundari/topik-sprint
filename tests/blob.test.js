import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAccount, __setBlob } from "../server/account.js";

// Vercel Blob-ын private хадгалалтыг санах ойд дуурайна.
function fakeBlob() {
  const files = new Map();
  return {
    files,
    async put(path, body, opts) {
      assert.equal(opts.access, "private");
      files.set(path, body);
      return { pathname: path };
    },
    async get(path) {
      if (!files.has(path)) return null;
      return { stream: new Response(files.get(path)).body };
    },
    async del(path) {
      files.delete(path);
    },
    async list({ prefix }) {
      return { blobs: [...files.keys()].filter((p) => p.startsWith(prefix)).map((pathname) => ({ pathname })), hasMore: false };
    },
  };
}

test("Blob сан: нэг аккаунтаар өөр төхөөрөмжөөс нэвтэрч, явц нь хамт ирнэ", async () => {
  const saved = { ...process.env };
  const blob = fakeBlob();
  __setBlob(blob);
  for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[k];
  process.env.VERCEL = "1";
  process.env.BLOB_READ_WRITE_TOKEN = "fake";
  process.env.ADMIN_NAMES = "admin";
  process.env.ADMIN_PIN = "070707";
  try {
    // Утсан дээр бүртгүүлж, явц хадгална
    const phone = (await handleAccount({ action: "register", name: "okuna", pin: "1234" })).json;
    assert.ok(phone.token);
    await handleAccount({ action: "save", data: { profile: { x: 1 }, srs: { b001: {} } } }, `Bearer ${phone.token}`);
    // Компьютер дээр нэвтэрнэ → явц ирнэ
    const pc = await handleAccount({ action: "login", name: "OKUNA", pin: "1234" });
    assert.equal(pc.status, 200);
    assert.deepEqual(pc.json.data.srs, { b001: {} });
    assert.equal((await handleAccount({ action: "login", name: "okuna", pin: "9999" })).status, 401);
    // Админ хэрэглэгчдийг харна
    const admin = (await handleAccount({ action: "login", name: "admin", pin: "070707" })).json;
    const users = (await handleAccount({ action: "admin_users" }, `Bearer ${admin.token}`)).json.users;
    assert.deepEqual(users.map((u) => u.name).sort(), ["admin", "okuna"]);
    assert.equal(users.find((u) => u.name === "okuna").words, 1);
    // Бүх зүйл private замд хадгалагдсан
    assert.ok([...blob.files.keys()].every((p) => p.startsWith("kv/")));
  } finally {
    __setBlob(null);
    process.env = saved;
  }
});
