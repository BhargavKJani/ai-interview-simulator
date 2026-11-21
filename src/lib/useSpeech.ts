"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the (still prefixed in Chrome/Safari) Web Speech recognition API. */
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech() {
  const [ttsSupported, setTtsSupported] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef<(t: string) => void>(() => {});

  useEffect(() => {
    // Feature detection must run after mount (window is unavailable during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    setSttSupported(!!getRecognitionCtor());
    return () => {
      recRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en-IN/i.test(v.lang)) ??
      voices.find((v) => /Google|Samantha|Natural/i.test(v.name) && /^en/i.test(v.lang)) ??
      voices.find((v) => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const startListening = useCallback((onFinal: (t: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition isn't supported in this browser. Try Chrome or Edge, or type your answer.");
      return;
    }
    onFinalRef.current = onFinal;
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim());
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(`Microphone error: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    setError(null);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setError("Couldn't start the microphone.");
    }
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { ttsSupported, sttSupported, speaking, listening, interim, error, speak, stopSpeaking, startListening, stopListening };
}
