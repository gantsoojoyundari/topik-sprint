// Нэр + 4 оронтой кодоор нэвтрэх аккаунт. Сервергүй: аккаунт, явц нь энэ төхөөрөмжийн браузерт хадгалагдана.
import { useSyncExternalStore } from "react";
import { openUser, closeUser, cachedData, legacyData, clearLegacy } from "./store.js";
import { applyTheme } from "./theme.js";

const SESSION_KEY = "topik-sprint:session";
const ACCOUNTS_KEY = "topik-sprint:accounts";
let session = readSession();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* хувийн цонх гэх мэт */
  }
}

function readSession() {
  const s = readJson(SESSION_KEY);
  return s?.name ? s : null;
}
function writeSession(s) {
  session = s;
  writeJson(SESSION_KEY, s);
  emit();
}

const normalizeName = (name) => String(name ?? "").normalize("NFC").trim().replace(/\s+/g, " ");
const userKey = (name) => normalizeName(name).toLowerCase();

async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validate(name, pin) {
  const n = normalizeName(name);
  if (n.length < 2 || n.length > 24) throw new Error("Хэрэглэгчийн нэр 2–24 тэмдэгт байна.");
  if (!/^\d{4}$/.test(String(pin ?? ""))) throw new Error("Код 4 оронтой тоо байна.");
  return n;
}

function activate(name, data) {
  openUser(userKey(name), data, null);
  applyTheme();
  writeSession({ name });
}

export async function register(rawName, pin, { importLocal }) {
  const name = validate(rawName, pin);
  const key = userKey(name);
  const accounts = readJson(ACCOUNTS_KEY) ?? {};
  if (accounts[key]) throw new Error("Энэ нэр аль хэдийн бүртгэлтэй байна. Өөр нэр сонгох эсвэл «Нэвтрэх»-ээр орно уу.");
  const salt = crypto.randomUUID();
  accounts[key] = { name, salt, hash: await hashPin(pin, salt), createdAt: Date.now() };
  writeJson(ACCOUNTS_KEY, accounts);
  const data = importLocal ? legacyData() : null;
  if (importLocal) clearLegacy();
  activate(name, data);
}

export async function login(rawName, pin) {
  validate(rawName, pin);
  const user = (readJson(ACCOUNTS_KEY) ?? {})[userKey(rawName)];
  if (!user) throw new Error("Ийм нэртэй хэрэглэгч алга. «Бүртгүүлэх»-ээр шинээр үүсгэнэ үү.");
  if ((await hashPin(pin, user.salt)) !== user.hash) throw new Error("Код буруу байна.");
  activate(user.name, cachedData(userKey(user.name)));
}

export function logout() {
  writeSession(null);
  closeUser();
  applyTheme("light");
}

/** Апп ачаалахад өмнө нэвтэрсэн хэрэглэгчийг нээнэ. */
export function restore() {
  if (!session) return;
  const key = userKey(session.name);
  if (!(readJson(ACCOUNTS_KEY) ?? {})[key]) return writeSession(null);
  openUser(key, cachedData(key), null);
  applyTheme();
}

export function hasLegacyData() {
  return !!legacyData();
}

const snap = () => session;
export function useSession() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), snap);
}
