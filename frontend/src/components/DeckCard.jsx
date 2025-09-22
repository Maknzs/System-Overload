import "./DeckCard.css";
import deckBack from "../assets/cards/SystemOverload.webp"; // put an image here

export default function DeckCard({ count = 0, onClick, disabled, anchorRef }) {
  const label = `Deck (${count} ${count === 1 ? "card" : "cards"} remaining)`;
  return (
    <button
      type="button"
      className={`deckcard ${disabled ? "is-disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      ref={anchorRef}
    >
      <img
        className="deckcard__img"
        src={deckBack}
        alt="Deck back"
        decoding="async"
        width={130}
        height={175}
      />
    </button>
  );
}
