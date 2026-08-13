"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

export interface SpeechRecognitionHookState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
}

export interface SpeechRecognitionHookActions {
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  onTranscriptReady: (callback: (transcript: string) => void) => void;
}

const RESTART_DELAY_MS = 200;
const START_RETRY_DELAY_MS = 500;

const FATAL_ERRORS = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
]);

const NON_FATAL_ERRORS = new Set(["no-speech", "aborted"]);

const getSpeechRecognitionConstructor = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as WindowWithSpeechRecognition;
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
};

const getErrorMessage = (error: string) => {
  switch (error) {
    case "audio-capture":
      return "No microphone was found or it is unavailable.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Please allow it in your browser settings.";
    case "network":
      return "Speech recognition network error. Please try again.";
    default:
      return "Speech recognition failed. Please try again.";
  }
};

export function useSpeechRecognition(
  lang = "en-US",
): SpeechRecognitionHookState & SpeechRecognitionHookActions {
  const transcriptReadyCallbackRef = useRef<
    ((transcript: string) => void) | null
  >(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const wantListeningRef = useRef(false);
  const lastErrorWasFatalRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const beginRecognitionRef = useRef<(() => void) | null>(null);

  const [isSupported] = useState(() =>
    Boolean(getSpeechRecognitionConstructor()),
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearStartRetryTimer = useCallback(() => {
    if (startRetryTimerRef.current !== null) {
      clearTimeout(startRetryTimerRef.current);
      startRetryTimerRef.current = null;
    }
  }, []);

  const rescueInterim = useCallback(() => {
    const pendingInterim = interimTranscriptRef.current.trim();
    if (!pendingInterim) {
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      return;
    }

    finalTranscriptRef.current =
      `${finalTranscriptRef.current} ${pendingInterim}`.trim();
    interimTranscriptRef.current = "";
    setTranscript(finalTranscriptRef.current);
    setInterimTranscript("");
  }, []);

  const beginRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition || !wantListeningRef.current) {
      return;
    }

    clearRestartTimer();
    clearStartRetryTimer();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) {
        return;
      }
      lastErrorWasFatalRef.current = false;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      let interimText = "";
      let finalText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const currentResult = event.results[index];
        const currentTranscript = currentResult[0]?.transcript ?? "";

        if (currentResult.isFinal) {
          finalText += currentTranscript;
        } else {
          interimText += currentTranscript;
        }
      }

      if (finalText) {
        finalTranscriptRef.current =
          `${finalTranscriptRef.current} ${finalText}`.trim();
        setTranscript(finalTranscriptRef.current);
      }

      interimTranscriptRef.current = interimText.trim();
      setInterimTranscript(interimTranscriptRef.current);
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) {
        return;
      }

      if (NON_FATAL_ERRORS.has(event.error)) {
        return;
      }

      if (FATAL_ERRORS.has(event.error)) {
        lastErrorWasFatalRef.current = true;
        wantListeningRef.current = false;
        clearRestartTimer();
        clearStartRetryTimer();
        setError(getErrorMessage(event.error));
        setIsListening(false);
        interimTranscriptRef.current = "";
        setInterimTranscript("");
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        return;
      }

      lastErrorWasFatalRef.current = true;
      wantListeningRef.current = false;
      clearRestartTimer();
      clearStartRetryTimer();
      setError(getErrorMessage(event.error));
      setIsListening(false);
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }

      rescueInterim();

      if (!wantListeningRef.current || lastErrorWasFatalRef.current) {
        setIsListening(false);
        const completedTranscript = finalTranscriptRef.current.trim();
        if (completedTranscript) {
          transcriptReadyCallbackRef.current?.(completedTranscript);
        }
        return;
      }

      // Keep isListening true across Chrome auto-ends; restart shortly.
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        beginRecognitionRef.current?.();
      }, RESTART_DELAY_MS);
    };

    try {
      recognition.start();
    } catch {
      if (!wantListeningRef.current) {
        setIsListening(false);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
        return;
      }

      // InvalidStateError / start-too-soon — retry once after a short delay.
      startRetryTimerRef.current = setTimeout(() => {
        startRetryTimerRef.current = null;
        if (!wantListeningRef.current) {
          return;
        }
        try {
          recognition.start();
        } catch {
          wantListeningRef.current = false;
          setError("Unable to start speech recognition.");
          setIsListening(false);
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
        }
      }, START_RETRY_DELAY_MS);
    }
  }, [clearRestartTimer, clearStartRetryTimer, lang, rescueInterim]);

  useEffect(() => {
    beginRecognitionRef.current = beginRecognition;
  }, [beginRecognition]);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    clearRestartTimer();
    clearStartRetryTimer();

    // Stop any previous instance without treating it as a user commit race.
    const previous = recognitionRef.current;
    if (previous) {
      try {
        previous.abort();
      } catch {
        // ignore
      }
      if (recognitionRef.current === previous) {
        recognitionRef.current = null;
      }
    }

    wantListeningRef.current = true;
    lastErrorWasFatalRef.current = false;
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
    setIsListening(true);

    beginRecognition();
  }, [beginRecognition, clearRestartTimer, clearStartRetryTimer]);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    lastErrorWasFatalRef.current = false;
    clearRestartTimer();
    clearStartRetryTimer();

    const recognition = recognitionRef.current;
    if (!recognition) {
      rescueInterim();
      setIsListening(false);
      const completedTranscript = finalTranscriptRef.current.trim();
      if (completedTranscript) {
        transcriptReadyCallbackRef.current?.(completedTranscript);
      }
      return;
    }

    try {
      recognition.stop();
    } catch {
      rescueInterim();
      setIsListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      const completedTranscript = finalTranscriptRef.current.trim();
      if (completedTranscript) {
        transcriptReadyCallbackRef.current?.(completedTranscript);
      }
    }
  }, [clearRestartTimer, clearStartRetryTimer, rescueInterim]);

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const onTranscriptReady = useCallback(
    (callback: (transcript: string) => void) => {
      transcriptReadyCallbackRef.current = callback;
    },
    [],
  );

  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearRestartTimer();
      clearStartRetryTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [clearRestartTimer, clearStartRetryTimer]);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    onTranscriptReady,
  };
}
