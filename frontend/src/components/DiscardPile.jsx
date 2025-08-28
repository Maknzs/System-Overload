import React from "react";
import "./DiscardPile.css";
import { CARD_IMG } from "../game/cards";

/**
 * Newest card appears on the RIGHT, older cards are pushed to the LEFT.
 * Newest also has the highest z-index so it visually sits on top.
 */
export default function DiscardPile({ cards = [], maxToShow = 10, onClick }) {
  // Take last N, then reverse so index 0 = newest (rightmost)
  const recentNewestFirst = cards.slice(-maxToShow).reverse();

  return (
    <button
      type="button"
      className={`discard ${recentNewestFirst.length ? "" : "is-empty"}`}
      onClick={onClick}
      title={
        recentNewestFirst.length
          ? `Discard (${cards.length})`
          : "Discard (empty)"
      }
    >
      {recentNewestFirst.length === 0 ? (
        <div className="discard__empty">—</div>
      ) : (
        <div className="discard__stack">
          {recentNewestFirst.map((name, i) => {
            const src = CARD_IMG[name];
            return (
              <div
                key={`${name}-${i}`}
                className="discard__card"
                style={{ "--i": i }} // i=0 is newest (rightmost)
                title={name}
              >
                {src ? (
                  <img src={src} alt={name} />
                ) : (
                  <div className="discard__placeholder">{name}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="discard__badge">{cards.length}</div>
      <div className="discard__label">Discard Pile</div>
    </button>
  );
}
