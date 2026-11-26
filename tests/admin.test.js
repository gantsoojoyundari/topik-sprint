import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAccount } from "../server/account.js";

test("админ: зөвхөн ADMIN_NAMES дахь хэрэглэгч удирдана", async () => {
  process.env.ADMIN_NAMES = "admin";
  process.env.ADMIN_PIN = "070707";
  const call = (body, token) => handleAccount(body, token ? `Bearer ${token}` : "");
  // Админ нэрийг өөр кодоор бүртгүүлж/нэвтэрч чадахгүй
  assert.equal((await call({ action: "register", name: "Admin", pin: "1234" })).status, 403);
  assert.equal((await call({ action: "login", name: "admin", pin: "1234" })).status, 404);
  // ADMIN_PIN-ээр «Нэвтрэх» — аккаунт өөрөө үүснэ, том/жижиг үсэг хамаагүй
  const admin = (await call({ action: "login", name: "ADMIN", pin: "070707" })).json;
  assert.ok(admin.token);
  const user = (await call({ action: "register", name: "Сурагч", pin: "2222" })).json;
  assert.equal(admin.admin, true);
  assert.equal(user.admin, false);

  // Энгийн хэрэглэгч админ үйлдэл хийж чадахгүй
  assert.equal((await call({ action: "admin_users" }, user.token)).status, 403);
  assert.equal((await call({ action: "content_save", content: {} }, user.token)).status, 403);

  const list = (await call({ action: "admin_users" }, admin.token)).json.users;
  assert.deepEqual(list.map((u) => u.name).sort(), ["admin", "Сурагч"].sort());

  // Код солих → шинэ кодоор нэвтэрнэ
  assert.equal((await call({ action: "admin_set_pin", name: "сурагч", pin: "3333" }, admin.token)).status, 200);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "2222" })).status, 401);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "3333" })).status, 200);

  // Агуулга нийтлэх → хүн бүр уншина
  const story = { id: "c1", title: "Тест", sentences: [{ mn: "Ус ууна.", t: [["물을", "ус", "b017"], ["마셔요.", "ууна", "b050"]] }] };
  await call({ action: "content_save", content: { stories: [story], sentences: [] } }, admin.token);
  assert.equal((await call({ action: "content_get" })).json.content.stories[0].title, "Тест");

  // Өөрийгөө устгаж болохгүй, бусдыг болно
  assert.equal((await call({ action: "admin_delete", name: "admin" }, admin.token)).status, 400);
  assert.equal((await call({ action: "admin_delete", name: "Сурагч" }, admin.token)).status, 200);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "3333" })).status, 404);
});

test("админ: хадгалах сангүй (Vercel) үед ч admin/ADMIN_PIN-ээр нэвтэрнэ", async () => {
  const saved = { ...process.env };
  process.env.VERCEL = "1";
  for (const k of ["KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) delete process.env[k];
  process.env.ADMIN_NAMES = "admin";
  process.env.ADMIN_PIN = "070707";
  try {
    const bad = await handleAccount({ action: "login", name: "admin", pin: "111111" });
    assert.equal(bad.json.code, "no_storage");
    const r = await handleAccount({ action: "login", name: "Admin", pin: "070707" });
    assert.equal(r.status, 200);
    assert.equal(r.json.admin, true);
    assert.equal(r.json.name, "admin");
    // Токеноор дахин ачаалахад админ хэвээр
    const load = await handleAccount({ action: "load" }, `Bearer ${r.json.token}`);
    assert.equal(load.json.admin, true);
    // Хуурамч токен ажиллахгүй
    const fake = r.json.token.slice(0, -3) + "AAA";
    assert.equal((await handleAccount({ action: "load" }, `Bearer ${fake}`)).json.code, "no_storage");
    // Код өөрчлөгдвөл хуучин токен хүчингүй
    process.env.ADMIN_PIN = "999999";
    assert.equal((await handleAccount({ action: "load" }, `Bearer ${r.json.token}`)).json.code, "no_storage");
    // Энгийн хэрэглэгч санг шаардана
    assert.equal((await handleAccount({ action: "login", name: "bat", pin: "1234" })).json.code, "no_storage");
  } finally {
    process.env = saved;
  }
});
