import { test } from "node:test";
import assert from "node:assert/strict";
import vocab from "../src/data/vocab.json" with { type: "json" };
import sentences from "../src/data/sentences.json" with { type: "json" };
import stories from "../src/data/stories.json" with { type: "json" };
import { similarity, tokenHits, norm, jamo } from "../src/lib/items.js";

const basic = new Map(vocab.words.filter((w) => w.topic === "basic").map((w) => [w.id, w]));

test("уншлага, өгүүлбэр: үг бүр аппын анхан шатны үгсээс", () => {
  const toks = [...sentences.flatMap((s) => s.t), ...stories.flatMap((s) => s.sentences.flatMap((x) => x.t))];
  for (const [ko, mn, id] of toks) {
    assert.ok(basic.has(id), `${ko}: ${id} үгсийн санд алга`);
    assert.ok(mn, `${ko}: утга хоосон`);
  }
});

test("өгүүлбэр: words ба t таарна, монгол утга давхцахгүй", () => {
  for (const s of sentences) {
    assert.deepEqual(s.words, s.t.map((x) => x[0]));
    assert.equal(s.ko, s.words.join(" "));
  }
  assert.equal(new Set(sentences.map((s) => s.mn)).size, sentences.length);
});

test("ярих/диктант: харьцуулалт", () => {
  assert.equal(norm("물을 마셔요."), "물을마셔요");
  assert.equal(similarity("물을 마셔요", "물을마셔요"), 1);
  assert.ok(similarity("물을 마셔요", "무를 마셔요") >= 0.6);
  assert.deepEqual(tokenHits([["물을"], ["마셔요"]], "물을 먹어요"), [true, false]);
  assert.deepEqual(jamo("김"), ["ㄱ", "ㅣ", "ㅁ"]);
  assert.deepEqual(jamo("보"), ["ㅂ", "ㅗ"]);
});
