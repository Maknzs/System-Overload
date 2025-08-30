// components/Card.jsx
import "./Card.css";
import { CARD_IMG, STOCK_CARD_IMG } from "../game/cards";

export default function Card({
  name,
  size = "hand",
  onClick,
  disabled = false,
  faceDown = false,
  allowClickWhenFaceDown = false,
  onDisabledClick,
  src,
  title,
  style,
}) {
  // Intrinsic dimension hints to reduce layout shift and speed decode
  const dims =
    size === "deck"
      ? { width: 170, height: 230 }
      : size === "discard"
      ? { width: 130, height: 180 }
      : { width: 130, height: 180 }; // default to hand size
  const imgSrc = faceDown
    ? STOCK_CARD_IMG
    : src || CARD_IMG[name] || STOCK_CARD_IMG;

  const isDisabled = disabled || (faceDown && !allowClickWhenFaceDown);
  const handleClick = isDisabled ? onDisabledClick : onClick;

  return (
    <button
      type="button"
      className={`ui-card card--${size}${isDisabled ? " is-disabled" : ""}`}
      data-card={name}
      onClick={handleClick}
      // hide the real card name when face-down
      title={faceDown ? "Hidden card" : title || name}
      aria-label={faceDown ? "Hidden card" : title || name}
      style={style}
    >
      <img
        src={imgSrc}
        alt={faceDown ? "Hidden card" : name}
        decoding="async"
        {...dims}
      />
    </button>
  );
}
