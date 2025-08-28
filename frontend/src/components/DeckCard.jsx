import "./DeckCard.css";
import deckBack from "../assets/cards/SystemOverload.png"; // put an image here

export default function DeckCard({ count = 0, onClick, disabled }) {
  const label = `Deck (${count} ${count === 1 ? "card" : "cards"} remaining)`;
  return (
    <button
      type="button"
      className={`deckcard ${disabled ? "is-disabled" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <img className="deckcard__img" src={deckBack} alt="Deck back" />
    </button>
  );
}
