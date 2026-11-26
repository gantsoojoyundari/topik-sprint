// Админ аппаас нэмсэн уншлага, өгүүлбэр (сервер: content:topik). Үндсэн JSON-тэй нийлүүлж ашиглана.
// Кэшлэдэг тул интернэтгүй үед ч сүүлд татсан агуулга харагдана.
import { useSyncExternalStore } from "react";
import baseStories from "../data/stories.json";
import baseSentences from "../data/sentences.json";

const KEY = "topik-sprint:content";
const EMPTY = { stories: [], sentences: [] };
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
  extra = { stories: c?.stories ?? [], sentences: c?.sentences ?? [] };
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
export const useStories = () => {
  const e = useExtra();
  return e.stories.length ? [...baseStories, ...e.stories] : baseStories;
};
export const useSentences = () => {
  const e = useExtra();
  return e.sentences.length ? [...baseSentences, ...e.sentences] : baseSentences;
};
