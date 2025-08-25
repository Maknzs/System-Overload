import { useEffect, useRef } from "react";

export default function PrivacyScreen({ show, onContinue, playerName }) {
  const btnRef = useRef(null);

  // Basic focus management when the modal opens
  useEffect(() => {
    if (show && btnRef.current) {
      btnRef.current.focus();
    }
  }, [show]);

  // Close with Enter or Space; ignore clicks behind the modal
  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onContinue?.();
    }
    if (e.key === "Escape") {
      // optional: allow closing with Esc
      e.preventDefault();
      onContinue?.();
    }
  }

  if (!show) return null;

  return (
    <div
      className="
        fixed inset-0 z-50
        bg-black/60
        backdrop-blur-sm    /* Tailwind: blur the background */
        flex items-center justify-center
      "
      role="dialog"
      aria-modal="true"
      aria-label="Pass device"
      onClick={(e) => {
        // Clicks on the scrim do nothing (force explicit button click)
        e.stopPropagation();
      }}
      onKeyDown={onKeyDown}
    >
      <div
        className="
          bg-white text-black
          max-w-sm w-[90%]
          rounded-xl shadow-xl
          p-6
          ring-1 ring-black/10
        "
        // prevent bubbling to backdrop
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Pass the device</h2>
          <p className="mt-2 text-gray-700">
            It’s <span className="font-bold">{playerName}</span>’s turn.
          </p>

          <button
            ref={btnRef}
            className="
              mt-6 inline-flex items-center justify-center
              px-4 py-2 rounded-lg
              bg-blue-600 hover:bg-blue-700
              text-white font-medium
              focus:outline-none focus:ring focus:ring-blue-300
            "
            onClick={onContinue}
          >
            I’m {playerName} — start my turn
          </button>

          {/* Optional hint */}
          <div className="mt-3 text-xs text-gray-500">
            Press <kbd className="px-1 py-0.5 border rounded">Enter</kbd> to
            continue
          </div>
        </div>
      </div>
    </div>
  );
}
