import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Lobby.css";

// Allows up to 5 total participants. Each row can be Human or AI Bot.
export default function Lobby({ onStart, onBack, authed }) {
  const [players, setPlayers] = useState([
    { name: "", isBot: false },
    { name: "", isBot: false },
  ]);
  const nav = useNavigate();
  const BOT_NAMES = ["Vizzini", "Inigo", "Fezzik", "Westley"];

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
    // Bots are named in order: Vizzini, Inigo Montoya, Fezzik, Prince Humperdinck
    let botCounter = 0;
    const finalized = players.map((p, i) => {
      let name = (p.name || "").trim();
      if (!name) {
        if (p.isBot) {
          // Use next bot name from the list; fall back to generic if more than provided
          name = BOT_NAMES[botCounter] || `Bot ${botCounter + 1}`;
          botCounter += 1;
        } else {
          name = `Player ${i + 1}`;
        }
      }
      return { ...p, name };
    });

    const valid = finalized.filter((p) => Boolean(p.name));
    if (valid.length < 2) return; // need at least 2 participants

    // Map to shape expected by Game route
    onStart(
      valid.map((p, i) => ({ id: String(i + 1), name: p.name, isBot: p.isBot }))
    );
  };

  const filledCount = players.filter((p) => (p.name || "").trim()).length;

  return (
    <div className="page">
      <h1 className="page-header">Lobby</h1>

      <div className="card">
        <div className="section-title">Enter Player Names</div>
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
            className="btn btn-accent"
            onClick={start}
            disabled={!(players[0]?.name || "").trim()}
          >
            Start Game
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => addPlayer(true)}
            disabled={players.length >= 5}
          >
            Add Bot
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => (authed ? onBack() : nav("/login"))}
          >
            {authed ? "View Profile" : "Login / Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
