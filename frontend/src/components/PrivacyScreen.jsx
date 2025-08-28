import React, { useEffect } from "react";
import Button from "./Button";
import "./PrivacyScreen.css";

export default function PrivacyScreen({ show, playerName, onContinue }) {
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => (e.key === "Enter" ? onContinue?.() : undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onContinue]);

  if (!show) return null;
  return (
    <div
      className="ps-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pass device"
    >
      <div className="ps-modal">
        <div className="ps-title">Pass the device</div>
        <div>
          It’s <span className="ps-name">{playerName}</span>’s turn.
        </div>
        <div className="ps-hint">
          Press <b>Enter</b> or click continue.
        </div>
        <div style={{ marginTop: 12 }}>
          <Button onClick={onContinue}>I’m {playerName} — start my turn</Button>
        </div>
      </div>
    </div>
  );
}
