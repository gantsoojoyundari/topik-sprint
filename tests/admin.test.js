import { test } from "node:test";
import assert from "node:assert/strict";
import { handleAccount } from "../server/account.js";

test("админ: зөвхөн ADMIN_NAMES дахь хэрэглэгч удирдана", async () => {
  process.env.ADMIN_NAMES = "Багш";
  const call = (body, token) => handleAccount(body, token ? `Bearer ${token}` : "");
  const admin = (await call({ action: "register", name: "багш", pin: "1111" })).json;
  const user = (await call({ action: "register", name: "Сурагч", pin: "2222" })).json;
  assert.equal(admin.admin, true);
  assert.equal(user.admin, false);

  // Энгийн хэрэглэгч админ үйлдэл хийж чадахгүй
  assert.equal((await call({ action: "admin_users" }, user.token)).status, 403);
  assert.equal((await call({ action: "content_save", content: {} }, user.token)).status, 403);

  const list = (await call({ action: "admin_users" }, admin.token)).json.users;
  assert.deepEqual(list.map((u) => u.name).sort(), ["Сурагч", "багш"]);

  // Код солих → шинэ кодоор нэвтэрнэ
  assert.equal((await call({ action: "admin_set_pin", name: "сурагч", pin: "3333" }, admin.token)).status, 200);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "2222" })).status, 401);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "3333" })).status, 200);

  // Агуулга нийтлэх → хүн бүр уншина
  const story = { id: "c1", title: "Тест", sentences: [{ mn: "Ус ууна.", t: [["물을", "ус", "b017"], ["마셔요.", "ууна", "b050"]] }] };
  await call({ action: "content_save", content: { stories: [story], sentences: [] } }, admin.token);
  assert.equal((await call({ action: "content_get" })).json.content.stories[0].title, "Тест");

  // Өөрийгөө устгаж болохгүй, бусдыг болно
  assert.equal((await call({ action: "admin_delete", name: "багш" }, admin.token)).status, 400);
  assert.equal((await call({ action: "admin_delete", name: "Сурагч" }, admin.token)).status, 200);
  assert.equal((await call({ action: "login", name: "Сурагч", pin: "3333" })).status, 404);
});
