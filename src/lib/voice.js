// Ярианы дасгалд: (1) браузерын яриа таних (ko-KR), (2) өөрийн дууг бичиж буцааж тоглуулах.
import { useEffect, useRef, useState } from "react";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canRecognize = !!SR;
export const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/** start() → сонсож эхэлнэ; дуусахад onResult(alternatives[]) дуудагдана. */
export function useRecognizer(onResult) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  const rec = useRef(null);
  const cb = useRef(onResult);
  cb.current = onResult;

  useEffect(() => () => rec.current?.abort(), []);

  function start() {
    if (!SR || listening) return;
    const r = new SR();
    r.lang = "ko-KR";
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    let finals = [];
    r.onresult = (e) => {
      const res = e.results[e.results.length - 1];
      setInterim(res[0].transcript);
      if (res.isFinal) finals = Array.from(res).map((a) => a.transcript);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "mic" : e.error === "no-speech" ? "silence" : e.error);
    r.onend = () => {
      setListening(false);
      rec.current = null;
      cb.current(finals);
    };
    setError(null);
    setInterim("");
    setListening(true);
    rec.current = r;
    r.start();
  }
  const stop = () => rec.current?.stop();
  return { listening, interim, error, start, stop };
}

/** Өөрийн дууг бичих: toggle() эхлүүлж/зогсооно, url — бичлэг. */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState(null);
  const ref = useRef(null);

  useEffect(() => () => ref.current?.stream?.getTracks().forEach((t) => t.stop()), []);

  async function toggle() {
    if (recording) return ref.current?.rec.stop();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const u = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
      setUrl(u);
      new Audio(u).play().catch(() => {});
    };
    ref.current = { rec, stream };
    rec.start();
    setRecording(true);
    // Хэт удаан бичихээс сэргийлж 8 секундэд өөрөө зогсооно.
    setTimeout(() => rec.state === "recording" && rec.stop(), 8000);
  }
  return { recording, url, toggle, reset: () => setUrl(null) };
}
