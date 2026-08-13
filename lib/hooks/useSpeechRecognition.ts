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
    case "no-speech":
      return "No speech was detected. Please try again.";
    case "audio-capture":
      return "No microphone was found or it is unavailable.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Please allow it in your browser settings.";
    case "network":
      return "Speech recognition network error. Please try again.";
    case "aborted":
      return "Speech recognition was stopped.";
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
  const stoppedByUserRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [isSupported] = useState(() =>
    Boolean(getSpeechRecognitionConstructor()),
  );
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    // Abort any previous instance to avoid conflicts
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    stoppedByUserRef.current = false;
    setError(null);
    setInterimTranscript("");

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
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
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.trim();
        setTranscript(finalTranscriptRef.current);
      }

      setInterimTranscript(interimText.trim());
    };

    recognition.onerror = (event) => {
      setError(getErrorMessage(event.error));
      setInterimTranscript("");

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed" ||
        event.error === "audio-capture"
      ) {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");

      const completedTranscript = finalTranscriptRef.current.trim();
      if (completedTranscript && stoppedByUserRef.current) {
        transcriptReadyCallbackRef.current?.(completedTranscript);
      }

      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setError("Unable to start speech recognition.");
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }

    stoppedByUserRef.current = true;
    try {
      recognition.stop();
    } catch {
      // Already stopped or not started
    }
  }, []);

  const clearTranscript = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const onTranscriptReady = useCallback(
    (callback: (transcript: string) => void) => {
      transcriptReadyCallbackRef.current = callback;
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

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
