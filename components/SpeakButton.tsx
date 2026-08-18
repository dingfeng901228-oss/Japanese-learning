"use client";

// Browser-native TTS button. Uses the Web Speech API
// (window.speechSynthesis), which works in Chrome / Edge / Safari on
// desktop + mobile. Voice quality varies by browser/OS — for
// production-grade Japanese audio, swap in an OpenAI tts-1 audio
// route. For Phase 5 lite, native is good enough.
//
// Server Components can't use the Web Speech API (it's browser-only),
// so this is a Client Component. Wrap in a parent that already does
// the right thing for accessibility (e.g., pass `label`).

export function SpeakButton({
  text,
  lang = "ja-JP",
  label = "朗读",
}: {
  text: string;
  lang?: string;
  label?: string;
}) {
  function handleClick() {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      // Some browsers disable TTS without user gesture; nothing useful
      // we can do here. Silent no-op so the UI doesn't break.
      return;
    }

    // Cancel any in-flight utterance first so consecutive clicks
    // restart cleanly instead of queueing.
    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    // Slightly slower than default — easier for listening practice.
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
    >
      <span aria-hidden="true" className="text-base">
        🔊
      </span>
    </button>
  );
}
