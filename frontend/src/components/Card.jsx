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

  const frontSrc = src || CARD_IMG[name] || STOCK_CARD_IMG;
  const backSrc = STOCK_CARD_IMG;

  const isDisabled = disabled || (faceDown && !allowClickWhenFaceDown);
  const handleClick = isDisabled ? onDisabledClick : onClick;
  const label = faceDown ? "Hidden card" : title || name;

  const className = [
    "ui-card",
    `card--${size}`,
    isDisabled ? "is-disabled" : null,
    faceDown ? "is-face-down" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      data-card={name}
      onClick={handleClick}
      // hide the real card name when face-down
      title={label}
      aria-label={label}
      style={style}
    >
      {
        <img
          src={faceDown ? backSrc : frontSrc}
          alt={label}
          decoding="async"
          width={130}
          height={175}
        />
      }
    </button>
  );
}
