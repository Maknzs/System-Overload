import { useEffect, useReducer, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createDeck, shuffle, CARD } from "../game/cards";
import PrivacyScreen from "../components/PrivacyScreen";
import Card from "../components/Card";
import Button from "../components/Button";
import { api } from "../api";
import "./Game.css"; // page styles (section boxes, layout, log, etc.)

const PHASE = {
  AWAIT_ACTION: "AWAIT_ACTION",
  RESOLVE_FATAL: "RESOLVE_FATAL",
  CHOOSING_FAVOR: "CHOOSING_FAVOR",
};

function initialState(names) {
  const { deck, hands } = createDeck(names.length);
  return {
    players: names.map((n, i) => ({ id: i, name: n, alive: true })),
    turn: 0,
    turnsToTake: 1, // active player's remaining turns (DDoS stack)
    deck,
    discard: [],
    hands,
    peek: [], // Health Check preview (top 3)
    log: [],
    phase: PHASE.AWAIT_ACTION,

    // Attack handoff
    pendingExtraTurnsFor: null, // who will receive extra turns next
    extraTurns: 0,

    // fatal handling
    fatalCard: null,
    winner: null,
  };
}

function nextAlive(state, from) {
  let i = from;
  for (let step = 0; step < state.players.length; step++) {
    i = (i + 1) % state.players.length;
    if (state.players[i].alive) return i;
  }
  return from;
}

// Advance the turn, respecting remaining-turns and queued Attack turns
function advanceTurn(S) {
  const pid = S.turn;

  // If current player still owes more turns (from DDoS), stay on them.
  if (S.turnsToTake > 1) {
    S.turnsToTake -= 1;
    S.log.push(
      `${S.players[pid].name} continues (remaining turns: ${S.turnsToTake}).`
    );
    S.peek = [];
    return S;
  }

  // If an Attack queued extra turns for the next player, hand it off now.
  if (S.pendingExtraTurnsFor != null && S.extraTurns > 0) {
    const nxt = nextAlive(S, pid);
    S.turn = nxt;
    S.turnsToTake = S.extraTurns;
    S.extraTurns = 0; // ← use 0, not null
    S.pendingExtraTurnsFor = null; // ← clear the flag after handoff
    S.log.push(
      `${S.players[nxt].name} begins ${S.turnsToTake} forced turn(s).`
    );
    S.peek = [];
    return S;
  }

  // Normal next player
  S.turn = nextAlive(S, pid);
  S.turnsToTake = 1;
  S.peek = [];
  return S;
}

function reducer(state, action) {
  const S = {
    ...state,
    players: state.players.slice(),
    hands: state.hands.map((h) => h.slice()),
    deck: state.deck.slice(),
    discard: state.discard.slice(),
    log: state.log.slice(),
    peek: state.peek.slice(),
  };

  switch (action.type) {
    case "INIT":
      return initialState(action.names);

    case "DRAW": {
      if (!S.deck.length) {
        S.log.push("Deck empty. Shuffling discard into deck.");
        S.deck = shuffle(S.discard);
        S.discard = [];
      }
      const pid = S.turn;
      const card = S.deck.pop();

      if (card === CARD.FATAL) {
        S.log.push(`${S.players[pid].name} drew a ${CARD.FATAL}!`);
        S.phase = PHASE.RESOLVE_FATAL;
        S.fatalCard = CARD.FATAL;
        return S;
      }

      // Safe draw -> add to hand, then auto-advance
      S.hands[pid].push(card);
      S.log.push(`${S.players[pid].name} drew a card.`);
      return advanceTurn(S);
    }

    case "PLAY_SKIP": {
      const pid = S.turn;
      const i = S.hands[pid].indexOf(CARD.SKIP);
      if (i === -1) return S;
      S.hands[pid].splice(i, 1);
      S.discard.push(CARD.SKIP);
      S.log.push(
        `${S.players[pid].name} played ${CARD.SKIP} (skip remaining turns).`
      );
      return advanceTurn(S);
    }

    case "PLAY_ATTACK": {
      const pid = S.turn;
      const i = S.hands[pid].indexOf(CARD.ATTACK);
      if (i === -1) return S;
      S.hands[pid].splice(i, 1);
      S.discard.push(CARD.ATTACK);

      const nxt = nextAlive(S, pid);
      S.pendingExtraTurnsFor = nxt;
      S.extraTurns = 2; // +2 turns for next player
      S.log.push(
        `${S.players[pid].name} launched ${CARD.ATTACK}. ${S.players[nxt].name} must take +2 turns.`
      );
      return advanceTurn(S);
    }

    case "PLAY_SHUFFLE": {
      const pid = S.turn;
      const i = S.hands[pid].indexOf(CARD.SHUFFLE);
      if (i === -1) return S;
      S.hands[pid].splice(i, 1);
      S.discard.push(CARD.SHUFFLE);
      S.deck = shuffle(S.deck);
      S.log.push(`${S.players[pid].name} played ${CARD.SHUFFLE}.`);
      return S;
    }

    case "PLAY_FUTURE": {
      const pid = S.turn;
      const i = S.hands[pid].indexOf(CARD.FUTURE);
      if (i === -1) return S;
      S.hands[pid].splice(i, 1);
      S.discard.push(CARD.FUTURE);
      S.peek = S.deck.slice(-3); // end = top
      S.log.push(`${S.players[pid].name} ran ${CARD.FUTURE}.`);
      return S;
    }

    case "PLAY_FAVOR": {
      const pid = S.turn;
      const i = S.hands[pid].indexOf(CARD.FAVOR);
      if (i === -1) return S;
      S.hands[pid].splice(i, 1);
      S.discard.push(CARD.FAVOR);
      S.phase = PHASE.CHOOSING_FAVOR;
      S.log.push(
        `${S.players[pid].name} used ${CARD.FAVOR}. Choose a player to request one random card.`
      );
      return S;
    }

    case "RESOLVE_FAVOR_FROM": {
      const toId = action.toId; // target who gives
      const fromId = S.turn; // current player receives
      const opp = S.hands[toId];

      if (opp.length === 0) {
        S.log.push(`${S.players[toId].name} has no cards to give.`);
      } else {
        const idx = Math.floor(Math.random() * opp.length);
        const given = opp.splice(idx, 1)[0];
        S.hands[fromId].push(given);

        // visible to everyone EXCEPT the two involved
        S.log.push({
          text: `${S.players[fromId].name} received a random card from ${S.players[toId].name}.`,
          exclude: [fromId, toId],
        });
        // precise card only to the two involved
        S.log.push({
          text: `${S.players[fromId].name} received the card: ${given} from ${S.players[toId].name}.`,
          visibleTo: [fromId, toId],
        });
      }

      S.phase = PHASE.AWAIT_ACTION;
      return S;
    }

    case "USE_REBOOT_OR_EXPLODE": {
      const pid = S.turn;
      const idx = S.hands[pid].indexOf(CARD.REBOOT);
      if (idx !== -1) {
        // Player has Reboot; remove it now. The UI will follow with REBOOT_INSERT.
        S.hands[pid].splice(idx, 1);
        // Do NOT discard here yet; we’ll count it as used when we reinsert the Fatal.
        S.phase = PHASE.AWAIT_ACTION;
        return S;
      } else {
        // No Reboot: player explodes
        S.players[pid].alive = false;
        S.discard.push(CARD.FATAL);
        S.fatalCard = null;
        S.log.push(`${S.players[pid].name} exploded and is out!`);

        const alive = S.players.filter((p) => p.alive).length;
        if (alive === 1) {
          S.winner = S.players.find((p) => p.alive).name;
          return S;
        }
        return advanceTurn(S);
      }
    }

    case "REBOOT_INSERT": {
      // Player chose where to put the Fatal back. Top = 0 (end of array).
      const pos = action.pos;
      const insertIndex = Math.max(0, S.deck.length - pos); // guard negatives
      S.deck.splice(insertIndex, 0, CARD.FATAL);
      // Count the reboot as used now (single discard record)
      S.discard.push(CARD.REBOOT);
      S.fatalCard = null;
      S.phase = PHASE.AWAIT_ACTION;
      S.log.push(
        `${S.players[S.turn].name} used ${CARD.REBOOT} and reinserted the ${
          CARD.FATAL
        }.`
      );
      return advanceTurn(S);
    }

    default:
      return state;
  }
}

export default function Game() {
  const nav = useNavigate();
  const { state } = useLocation();
  const names = (state?.names || ["Player 1", "Player 2"])
    .map((s) => s.trim())
    .filter(Boolean);

  const [game, dispatch] = useReducer(reducer, initialState(names));
  const [hideHand, setHideHand] = useState(true);

  const me = game.players[game.turn];
  const hand = game.hands[game.turn];

  // Init once
  useEffect(() => {
    dispatch({ type: "INIT", names });
    setHideHand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show pass-device modal whenever turn changes
  useEffect(() => {
    setHideHand(true);
  }, [game.turn]);

  // Winner flow
  useEffect(() => {
    if (game.winner) {
      (async () => {
        try {
          await api.incrementGamesPlayed();
        } catch {}
        alert(`Winner: ${game.winner}`);
        nav("/");
      })();
    }
  }, [game.winner, nav]);

  const countAlive = game.players.filter((p) => p.alive).length;
  const canPlay = (name) => hand.includes(name);

  function onResolveFatal() {
    dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
  }
  function onReinsert(posFromTop) {
    dispatch({ type: "REBOOT_INSERT", pos: posFromTop });
  }

  return (
    <div className="page">
      <h1 className="page-header">System Overload — Local Game</h1>

      {/* Meta pills */}
      <div className="meta">
        <span className="pill">
          Players alive: {countAlive} / {game.players.length}
        </span>
        <span className="pill">
          Turn:
          <b style={{ marginLeft: 6 }}>{me?.name}</b>
          <span className="subtle" style={{ marginLeft: 6 }}>
            (need {game.turnsToTake} turn{game.turnsToTake > 1 ? "s" : ""})
          </span>
        </span>
      </div>

      {/* Pass-Device modal */}
      <PrivacyScreen
        show={hideHand}
        playerName={me?.name}
        onContinue={() => setHideHand(false)}
      />

      {/* Actions */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">Actions</div>
        <div className="hstack">
          <Button
            onClick={() => dispatch({ type: "DRAW" })}
            disabled={hideHand || game.phase !== PHASE.AWAIT_ACTION}
          >
            Draw
          </Button>

          <Button
            onClick={() => dispatch({ type: "PLAY_SKIP" })}
            disabled={
              hideHand ||
              !canPlay(CARD.SKIP) ||
              game.phase !== PHASE.AWAIT_ACTION
            }
          >
            Play {CARD.SKIP}
          </Button>

          <Button
            onClick={() => dispatch({ type: "PLAY_ATTACK" })}
            disabled={
              hideHand ||
              !canPlay(CARD.ATTACK) ||
              game.phase !== PHASE.AWAIT_ACTION
            }
          >
            Play {CARD.ATTACK}
          </Button>

          <Button
            onClick={() => dispatch({ type: "PLAY_SHUFFLE" })}
            disabled={
              hideHand ||
              !canPlay(CARD.SHUFFLE) ||
              game.phase !== PHASE.AWAIT_ACTION
            }
          >
            Play {CARD.SHUFFLE}
          </Button>

          <Button
            onClick={() => dispatch({ type: "PLAY_FUTURE" })}
            disabled={
              hideHand ||
              !canPlay(CARD.FUTURE) ||
              game.phase !== PHASE.AWAIT_ACTION
            }
          >
            Run {CARD.FUTURE}
          </Button>

          <Button
            onClick={() => dispatch({ type: "PLAY_FAVOR" })}
            disabled={
              hideHand ||
              !canPlay(CARD.FAVOR) ||
              game.phase !== PHASE.AWAIT_ACTION
            }
          >
            Use {CARD.FAVOR}
          </Button>
        </div>
      </div>

      {/* Health Check peek */}
      {game.peek.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Health Check (top 3)</div>
          <div>{[...game.peek].reverse().join(" • ")}</div>
        </div>
      )}

      {/* Fatal resolution */}
      {game.phase === PHASE.RESOLVE_FATAL && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">You drew a {CARD.FATAL}!</div>
          {hand.includes(CARD.REBOOT) ? (
            <>
              <div className="subtle" style={{ marginBottom: 10 }}>
                Use {CARD.REBOOT} and choose where to put the Fatal back:
              </div>
              <div className="hstack">
                {[0, 1, 2, 3].map((pos) => (
                  <Button
                    key={pos}
                    onClick={() => {
                      dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
                      onReinsert(pos);
                    }}
                  >
                    {pos === 0 ? "Top" : `+${pos} deep`}
                  </Button>
                ))}
                <Button
                  onClick={() => {
                    dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
                    onReinsert(game.deck.length);
                  }}
                >
                  Bottom
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="subtle" style={{ marginBottom: 10 }}>
                No {CARD.REBOOT} available. You explode.
              </div>
              <Button onClick={onResolveFatal}>Continue</Button>
            </>
          )}
        </div>
      )}

      {/* Favor target selection */}
      {game.phase === PHASE.CHOOSING_FAVOR && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">
            Choose a player to take a random card from
          </div>
          <div className="hstack">
            {game.players
              .filter((p) => p.alive && p.id !== game.turn)
              .map((p) => (
                <Button
                  key={p.id}
                  onClick={() =>
                    dispatch({ type: "RESOLVE_FAVOR_FROM", toId: p.id })
                  }
                >
                  {p.name}
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Hand */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          {me?.name} — Hand ({hand.length})
        </div>
        <div className="hstack" style={{ flexWrap: "wrap" }}>
          {hand.map((c, i) => (
            <Card key={i} name={c} disabled />
          ))}
        </div>
      </div>

      {/* Deck / Discard */}
      <div
        className="hstack"
        style={{ gap: 12, flexWrap: "wrap", marginBottom: 16 }}
      >
        <div className="card" style={{ flex: "1 1 280px" }}>
          <div className="section-title">Deck</div>
          <div>
            <b className="deck-count">{game.deck.length}</b> cards
          </div>
        </div>
        <div className="card" style={{ flex: "1 1 280px" }}>
          <div className="section-title">Discard</div>
          <div>{game.discard.slice(-5).join(" • ") || "—"}</div>
        </div>
      </div>

      {/* Log with per-viewer visibility */}
      <div className="card">
        <div className="section-title">Log</div>
        {(() => {
          const viewerId = me?.id;
          const visible = game.log.filter((entry) => {
            if (typeof entry === "string") return true;
            if (entry.visibleTo) return entry.visibleTo.includes(viewerId);
            if (entry.exclude) return !entry.exclude.includes(viewerId);
            return true;
          });
          return (
            <ul className="list scroll">
              {visible.map((entry, i) => (
                <li key={i}>
                  {typeof entry === "string" ? (
                    entry
                  ) : (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: entry.text.replace(
                          /\*\*(.*?)\*\*/g,
                          "<b>$1</b>"
                        ),
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          );
        })()}
      </div>
    </div>
  );
}
