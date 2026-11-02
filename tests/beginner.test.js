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

test("эхлэгч: үндсэн 24 үсэг → үг нээгдэнэ; 40/60 үг → сонсгол/өгүүлбэр", () => {
  const hs = Object.fromEntries(hangul.letters.filter((l) => ["consonant", "vowel"].includes(l.group)).map((l) => [l.id, 2]));
  const basics = vocab.words.filter((w) => w.topic === "basic");
  const srs = (n) => Object.fromEntries(basics.slice(0, n).map((w) => [w.id, { due: "2026-11-03" }]));
  assert.deepEqual(beginnerTasks(beginnerState({ hangul: hs }), "d").map((t) => t.kind), ["hangul", "vocab"]);
  assert.deepEqual(beginnerTasks(beginnerState({ hangul: hs, srs: srs(40) }), "d").map((t) => t.kind), ["hangul", "vocab", "listening"]);
  assert.deepEqual(beginnerTasks(beginnerState({ hangul: hs, srs: srs(60) }), "d").map((t) => t.kind), ["hangul", "vocab", "listening", "sentence"]);
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
