import { test } from "node:test";
import assert from "node:assert/strict";
import { beginnerState, beginnerTasks } from "../src/lib/beginner.js";
import { galig } from "../src/lib/galig.js";
import hangul from "../src/data/hangul.json" with { type: "json" };
import vocab from "../src/data/vocab.json" with { type: "json" };

test("эхлэгч: эхэндээ зөвхөн үсгийн даалгавар", () => {
  const b = beginnerState({});
  assert.deepEqual(beginnerTasks(b, "2026-11-02").map((t) => t.kind), ["hangul"]);
  assert.equal(b.graduated, false);
});

test("эхлэгч: 24 үсэг → үг; 20 үг → уншлага/ярих/диктант (өдөрт нэг); 40/60 → сонсгол/өгүүлбэр", () => {
  const hs = Object.fromEntries(hangul.letters.filter((l) => ["consonant", "vowel"].includes(l.group)).map((l) => [l.id, 2]));
  const basics = vocab.words.filter((w) => w.topic === "basic");
  const srs = (n) => Object.fromEntries(basics.slice(0, n).map((w) => [w.id, { due: "2026-11-03" }]));
  const kinds = (n, d = "2026-11-02") => beginnerTasks(beginnerState({ hangul: hs, srs: srs(n) }), d).map((t) => t.kind);
  assert.deepEqual(kinds(0), ["hangul", "vocab"]);
  const rot = ["stories", "speaking", "dictation"];
  assert.equal(kinds(20).filter((k) => rot.includes(k)).length, 1);
  const seen = new Set(["2026-11-02", "2026-11-03", "2026-11-04"].flatMap((d) => kinds(20, d).filter((k) => rot.includes(k))));
  assert.equal(seen.size, 3);
  assert.ok(kinds(40).includes("listening"));
  assert.ok(kinds(60).includes("sentence"));
});

test("эхлэгч: бүх үсэг + бүх анхан шатны үг → төгссөн", () => {
  const hs = Object.fromEntries(hangul.letters.map((l) => [l.id, 2]));
  const srs = Object.fromEntries(vocab.words.filter((w) => w.topic === "basic").map((w) => [w.id, {}]));
  assert.equal(beginnerState({ hangul: hs, srs }).graduated, true);
});

test("галиг: холбох ба хамраар дуудах", () => {
  assert.equal(galig("감사합니다"), "гамсахамнида");
  assert.equal(galig("한국어"), "хангугө");
  assert.equal(galig("좋아요"), "жоаё");
  assert.equal(galig("물을 마셔요"), "мурыл масёё");
});
