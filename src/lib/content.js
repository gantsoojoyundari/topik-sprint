// Админ аппаас нэмсэн уншлага, өгүүлбэр (сервер: content:topik). Үндсэн JSON-тэй нийлүүлж ашиглана.
// Кэшлэдэг тул интернэтгүй үед ч сүүлд татсан агуулга харагдана.
import { useSyncExternalStore } from "react";
import baseStories from "../data/stories.json";
import baseSentences from "../data/sentences.json";

const KEY = "topik-sprint:content";
export const DEFAULT_CONFIG = {
  dailyGoal: 30, // өдрийн XP зорилго
  newWordsPerDay: 10, // эхлэгчийн өдөрт үзэх шинэ үг
  listeningAt: 40, // энгийн сонсгол нээгдэх үгийн тоо
  sentenceAt: 60, // өгүүлбэр зохиох нээгдэх үгийн тоо
  stories: true,
  speaking: true,
  dictation: true,
  announcement: "", // бүх хэрэглэгчид нүүр хуудсанд харагдана
  registrationClosed: false,
};
const EMPTY = { stories: [], sentences: [], config: {} };
let extra = read();
const listeners = new Set();

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function setExtra(c) {
  extra = { stories: c?.stories ?? [], sentences: c?.sentences ?? [], config: c?.config ?? {} };
  try {
    localStorage.setItem(KEY, JSON.stringify(extra));
  } catch {
    /* хувийн цонх */
  }
  listeners.forEach((l) => l());
}

export async function refreshContent() {
  try {
    const r = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "content_get" }),
    });
    if (r.ok) setExtra((await r.json()).content);
  } catch {
    /* интернэтгүй — кэш хэвээр */
  }
}
if (typeof window !== "undefined") refreshContent();

const sub = (l) => (listeners.add(l), () => listeners.delete(l));
export const useExtra = () => useSyncExternalStore(sub, () => extra);
let cfgCache = { src: null, val: DEFAULT_CONFIG };
export const getConfig = () => {
  if (cfgCache.src !== extra.config) cfgCache = { src: extra.config, val: { ...DEFAULT_CONFIG, ...(extra.config ?? {}) } };
  return cfgCache.val;
};
export const useConfig = () => useSyncExternalStore(sub, getConfig);
export const useStories = () => {
  const e = useExtra();
  return e.stories.length ? [...baseStories, ...e.stories] : baseStories;
};
export const useSentences = () => {
  const e = useExtra();
  return e.sentences.length ? [...baseSentences, ...e.sentences] : baseSentences;
};
