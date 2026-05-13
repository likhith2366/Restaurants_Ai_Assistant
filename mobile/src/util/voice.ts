// Thin wrapper around the browser's Web Speech API for voice input.
// Returns `null` from `start()` on platforms / browsers that don't support
// it so callers can fall back to keyboard entry.
//
// Web Speech API is supported in Chrome / Edge on desktop and Android.
// On iOS Safari and on React Native (Expo Go) it's not available;
// `isVoiceSupported()` reports that and the UI should hide the mic.

import { Platform } from "react-native";

type SRConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    readonly length: number;
    readonly [index: number]: {
      readonly isFinal: boolean;
      readonly [index: number]: { transcript: string };
    };
  };
}

function getCtor(): SRConstructor | null {
  if (Platform.OS !== "web") return null;
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SRConstructor;
    webkitSpeechRecognition?: SRConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getCtor() !== null;
}

export interface VoiceSession {
  stop: () => void;
  cancel: () => void;
}

export interface VoiceCallbacks {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
}

export function startListening(cb: VoiceCallbacks): VoiceSession | null {
  const Ctor = getCtor();
  if (!Ctor) {
    cb.onError?.("not-supported");
    return null;
  }
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0].transcript;
      if (res.isFinal) final += transcript;
      else interim += transcript;
    }
    if (final) cb.onFinal(final.trim());
    else if (interim) cb.onPartial?.(interim);
  };
  rec.onerror = (e) => cb.onError?.(e.error ?? "voice-error");
  rec.onend = () => cb.onEnd?.();

  try {
    rec.start();
  } catch (e) {
    cb.onError?.(e instanceof Error ? e.message : "voice-start-failed");
    return null;
  }
  return { stop: () => rec.stop(), cancel: () => rec.abort() };
}
