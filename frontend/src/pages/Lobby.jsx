import React, { useState } from "react";
import Button from "../components/Button";
import "./Lobby.css";

export default function Lobby({ onStart, onBack }) {
  const [names, setNames] = useState(["", ""]);

  const addPlayer = () => names.length < 5 && setNames([...names, ""]);
  const removePlayer = (i) =>
    names.length > 2 && setNames(names.filter((_, idx) => idx !== i));
  const update = (i, v) => {
    const next = names.slice();
    next[i] = v;
    setNames(next);
  };

  const start = () => {
    const players = names
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n, i) => ({ id: String(i + 1), name: n }));
    if (players.length >= 2) onStart(players);
  };

  return (
    <div className="page">
      <h1 className="page-header">Lobby</h1>

      <div className="card">
        <div className="section-title">Players</div>
        <div className="lobby-grid">
          {names.map((n, i) => (
            <div className="player-row" key={i}>
              <input
                className="input"
                value={n}
                placeholder={`Player ${i + 1} name`}
                onChange={(e) => update(i, e.target.value)}
              />
              {i >= 2 && (
                <button
                  className="btn btn-ghost"
                  onClick={() => removePlayer(i)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="lobby-actions">
          <button
            className="btn btn-ghost"
            onClick={addPlayer}
            disabled={names.length >= 5}
          >
            Add Player
          </button>
          <button
            className="btn btn-accent"
            onClick={start}
            disabled={names.filter((x) => x.trim()).length < 2}
          >
            Start Game
          </button>
          <button className="btn" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
