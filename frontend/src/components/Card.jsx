// components/Card.jsx
import "./Card.css";
import React from "react";
import { CARD_IMG, STOCK_CARD_IMG } from "../game/cards";

export default function Card({
  name,
  size = "hand",
  onClick,
  disabled = false,
  faceDown = false,
  allowClickWhenFaceDown = false,
  src,
  title,
  style,
}) {
  const imgSrc = faceDown
    ? STOCK_CARD_IMG
    : src || CARD_IMG[name] || STOCK_CARD_IMG;

  const isDisabled = disabled || (faceDown && !allowClickWhenFaceDown);

  return (
    <button
      type="button"
      className={`ui-card card--${size}${isDisabled ? " is-disabled" : ""}`}
      onClick={isDisabled ? undefined : onClick}
      // hide the real card name when face-down
      title={faceDown ? "Hidden card" : title || name}
      aria-label={faceDown ? "Hidden card" : title || name}
      style={style}
    >
      <img src={imgSrc} alt={faceDown ? "Hidden card" : name} />
    </button>
  );
}
