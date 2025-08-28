import React, { useState } from "react";
import Button from "../components/Button";
import "./Lobby.css";

// Allows up to 5 total participants. Each row can be Human or AI Bot.
export default function Lobby({ onStart, onBack }) {
  const [players, setPlayers] = useState([
    { name: "", isBot: false },
    { name: "", isBot: false },
  ]);

  const addPlayer = (isBot = false) =>
    players.length < 5 && setPlayers([...players, { name: "", isBot }]);

  const removePlayer = (i) =>
    players.length > 2 && setPlayers(players.filter((_, idx) => idx !== i));

  const updateName = (i, name) => {
    const next = players.slice();
    next[i] = { ...next[i], name };
    setPlayers(next);
  };

  const toggleBot = (i) => {
    const next = players.slice();
    next[i] = { ...next[i], isBot: !next[i].isBot };
    setPlayers(next);
  };

  const start = () => {
    // Assign defaults for any empty names before filtering
    const finalized = players.map((p, i) => ({
      ...p,
      name: (p.name || (p.isBot ? `Bot ${i + 1}` : `Player ${i + 1}`)).trim(),
    }));

    const valid = finalized.filter((p) => Boolean(p.name));
    if (valid.length < 2) return; // need at least 2 participants

    // Map to shape expected by Game route
    onStart(valid.map((p, i) => ({ id: String(i + 1), name: p.name, isBot: p.isBot })));
  };

  const filledCount = players.filter((p) => (p.name || "").trim()).length;

  return (
    <div className="page">
      <h1 className="page-header">Lobby</h1>

      <div className="card">
        <div className="section-title">Players</div>
        <div className="lobby-grid">
          {players.map((p, i) => (
            <div className="player-row" key={i}>
              <input
                className="input"
                value={p.name}
                placeholder={`${p.isBot ? "Bot" : "Player"} ${i + 1} name`}
                onChange={(e) => updateName(i, e.target.value)}
              />
              <label className="hstack" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={p.isBot}
                  onChange={() => toggleBot(i)}
                />
                AI Bot
              </label>
              {i >= 2 && (
                <button className="btn btn-ghost" onClick={() => removePlayer(i)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="lobby-actions">
          <button
            className="btn btn-ghost"
            onClick={() => addPlayer(true)}
            disabled={players.length >= 5}
          >
            Add Bot
          </button>
          <button
            className="btn btn-accent"
            onClick={start}
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
