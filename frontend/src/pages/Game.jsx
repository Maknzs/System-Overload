import { useEffect, useReducer, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createDeck,
  shuffle,
  CARD,
  CARD_IMG,
  STOCK_CARD_IMG,
  COMBO_CARDS,
  CARD_DESC,
} from "../game/cards";
import PrivacyScreen from "../components/PrivacyScreen";
import Card from "../components/Card";
import DeckCard from "../components/DeckCard";
import DiscardPile from "../components/DiscardPile";
import Button from "../components/Button";
import Modal from "../components/Modal";
import { api } from "../api";
import "./Game.css"; // page styles (section boxes, layout, log, etc.)

const PHASE = {
  AWAIT_ACTION: "AWAIT_ACTION",
  RESOLVE_FATAL: "RESOLVE_FATAL",
  CHOOSING_FAVOR: "CHOOSING_FAVOR",
  CHOOSING_PAIR_TARGET: "CHOOSING_PAIR_TARGET",
  CHOOSING_PAIR_CARD: "CHOOSING_PAIR_CARD",
  CHOOSING_TRIPLE_TARGET: "CHOOSING_TRIPLE_TARGET",
  CHOOSING_TRIPLE_CARD: "CHOOSING_TRIPLE_CARD",
};

const REQUESTABLE_CARDS = [
  CARD.REBOOT,
  CARD.SKIP,
  CARD.ATTACK,
  CARD.SHUFFLE,
  CARD.FUTURE,
  CARD.FAVOR,
  CARD.TAMPERED,
  CARD.NEW_ERROR,
  CARD.VALID_CREDS,
  CARD.ROGUE_AV,
  CARD.COFFEE,
];

const HAND_DISPLAY_ORDER = [
  CARD.REBOOT,
  CARD.SKIP,
  CARD.ATTACK,
  CARD.SHUFFLE,
  CARD.FUTURE,
  CARD.FAVOR,
  "Tampered Data Log",
  "New Error Code",
  "Valid Credentials?",
  "Rogue Anti-virus Software",
  "Coffee Fueled Programmer",
];

const STACK_SPACING = 20; // px gap between stacked duplicate cards

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
    combo: null,
    drawnCard: null,
    advanceAfterDraw: false,

    // Attack handoff
    pendingExtraTurnsFor: null, // who will receive extra turns next
    extraTurns: 0,

    // combo/fatal/winner handling
    comboTarget: null,
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

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
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

    case "CLEAR_PEEK":
      S.peek = [];
      return S;

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

      // Safe draw -> add to hand, show modal, advance after close
      S.hands[pid].push(card);
      S.log.push(`${S.players[pid].name} drew a card.`);
      S.drawnCard = card;
      S.advanceAfterDraw = true;
      return S;
    }

    case "END_DRAW": {
      S.drawnCard = null;
      const shouldAdvance = S.advanceAfterDraw;
      S.advanceAfterDraw = false;
      return shouldAdvance ? advanceTurn(S) : S;
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
        S.drawnCard = given;
        S.advanceAfterDraw = false;

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

    case "START_COMBO": {
      const pid = S.turn;
      const { cardName, mode } = action;
      const removeCount = mode === "TRIPLE" ? 3 : 2;
      for (let k = 0; k < removeCount; k++) {
        const idx = S.hands[pid].indexOf(cardName);
        if (idx !== -1) S.hands[pid].splice(idx, 1);
        S.discard.push(cardName);
      }
      S.combo = { type: mode, card: cardName };
      S.comboTarget = null;
      S.phase =
        mode === "TRIPLE"
          ? PHASE.CHOOSING_TRIPLE_TARGET
          : PHASE.CHOOSING_PAIR_TARGET;
      S.log.push(
        `${S.players[pid].name} played a ${mode.toLowerCase()} of ${cardName}.`
      );
      return S;
    }

    case "RESOLVE_PAIR_TARGET": {
      const toId = action.toId;
      S.comboTarget = toId;
      S.hands[toId] = shuffle(S.hands[toId]);
      S.phase = PHASE.CHOOSING_PAIR_CARD;
      return S;
    }

    case "RESOLVE_PAIR_FROM": {
      const pid = S.turn;
      const toId = S.comboTarget;
      const opp = S.hands[toId];

      if (opp.length === 0) {
        S.log.push(`${S.players[toId].name} had no cards to steal.`);
      } else {
        const idx = Math.min(action.index, opp.length - 1);
        const given = opp.splice(idx, 1)[0];
        S.hands[pid].push(given);
        S.log.push(
          `${S.players[pid].name} stole a card from ${S.players[toId].name}.`
        );
        S.drawnCard = given;
        S.advanceAfterDraw = false;
      }

      S.comboTarget = null;
      S.combo = null;
      S.phase = PHASE.AWAIT_ACTION;
      return S;
    }

    case "RESOLVE_TRIPLE_TARGET": {
      S.comboTarget = action.toId;
      S.phase = PHASE.CHOOSING_TRIPLE_CARD;
      return S;
    }

    case "RESOLVE_TRIPLE_NAME": {
      const pid = S.turn;
      const toId = S.comboTarget;
      const cardName = action.cardName;
      const opp = S.hands[toId];
      const idx = opp.indexOf(cardName);
      if (idx !== -1) {
        opp.splice(idx, 1);
        S.hands[pid].push(cardName);
        S.drawnCard = cardName;
        S.advanceAfterDraw = false;
        S.log.push(
          `${S.players[pid].name} received ${cardName} from ${S.players[toId].name}.`
        );
      } else {
        S.log.push(`${S.players[toId].name} did not have ${cardName}.`);
      }
      S.comboTarget = null;
      S.combo = null;
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
        // No Reboot: player eliminated
        S.players[pid].alive = false;
        S.turnsToTake = 0;
        S.discard.push(CARD.FATAL);
        S.fatalCard = null;
        S.phase = PHASE.AWAIT_ACTION;
        S.peek = [];
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
  const [selectedCard, setSelectedCard] = useState(null);
  const [showPeekModal, setShowPeekModal] = useState(false);
  const [flipFatal, setFlipFatal] = useState(false);

  const me = game.players[game.turn];
  const hand = game.hands[game.turn];
  const hasReboot = hand.includes(CARD.REBOOT);
  const sortedHand = [...hand].sort((a, b) => {
    const ai = HAND_DISPLAY_ORDER.indexOf(a);
    const bi = HAND_DISPLAY_ORDER.indexOf(b);
    const aIndex = ai === -1 ? Number.MAX_VALUE : ai;
    const bIndex = bi === -1 ? Number.MAX_VALUE : bi;
    if (aIndex === bIndex) return 0;
    return aIndex - bIndex;
  });

  const groupedHand = [];
  for (const card of sortedHand) {
    const last = groupedHand[groupedHand.length - 1];
    if (last && last.card === card) {
      last.count += 1;
    } else {
      groupedHand.push({ card, count: 1 });
    }
  }

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

  // Show Health Check modal with top 3 cards
  useEffect(() => {
    if (game.peek.length > 0) {
      setShowPeekModal(true);
      const timer = setTimeout(() => {
        setShowPeekModal(false);
        dispatch({ type: "CLEAR_PEEK" });
      }, 5000);
      return () => clearTimeout(timer);
    }
    setShowPeekModal(false);
  }, [game.peek]);

  // Auto-close draw modal after 5 seconds
  useEffect(() => {
    if (game.drawnCard) {
      const timer = setTimeout(() => dispatch({ type: "END_DRAW" }), 5000);
      return () => clearTimeout(timer);
    }
  }, [game.drawnCard]);

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

  // Flip fatal card when no Reboot available
  useEffect(() => {
    if (game.phase === PHASE.RESOLVE_FATAL && !hasReboot) {
      const interval = setInterval(() => setFlipFatal((f) => !f), 750);
      return () => clearInterval(interval);
    }
    setFlipFatal(false);
  }, [game.phase, hasReboot]);

  const fatalCardSrc =
    game.phase === PHASE.RESOLVE_FATAL && !hasReboot && flipFatal
      ? STOCK_CARD_IMG
      : CARD_IMG[CARD.FATAL];

  const countAlive = game.players.filter((p) => p.alive).length;
  const canPlayNow =
    game.phase === PHASE.AWAIT_ACTION && !hideHand && !game.drawnCard;

  const selectedCount = selectedCard
    ? hand.filter((h) => h === selectedCard).length
    : 0;
  const isActionCard = [
    CARD.SKIP,
    CARD.ATTACK,
    CARD.SHUFFLE,
    CARD.FUTURE,
    CARD.FAVOR,
    CARD.REBOOT,
  ].includes(selectedCard);
  const canPlaySelected =
    isActionCard &&
    (selectedCard !== CARD.REBOOT
      ? canPlayNow
      : game.phase === PHASE.RESOLVE_FATAL);
  const canPair =
    COMBO_CARDS.includes(selectedCard) && selectedCount >= 2 && canPlayNow;
  const canTriple =
    COMBO_CARDS.includes(selectedCard) && selectedCount >= 3 && canPlayNow;

  function playCardByName(cardName) {
    if (!me?.alive) return;

    // If we’re resolving a Fatal, only Reboot makes sense here
    if (game.phase === PHASE.RESOLVE_FATAL) {
      if (cardName === CARD.REBOOT) {
        // Show your “choose position” UI or just reinsert top as example
        dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
        dispatch({ type: "REBOOT_INSERT", pos: 0 });
      }
      return;
    }

    if (!canPlayNow) return;

    switch (cardName) {
      case CARD.SKIP:
        dispatch({ type: "PLAY_SKIP" });
        break;
      case CARD.ATTACK:
        dispatch({ type: "PLAY_ATTACK" });
        break;
      case CARD.SHUFFLE:
        dispatch({ type: "PLAY_SHUFFLE" });
        break;
      case CARD.FUTURE:
        dispatch({ type: "PLAY_FUTURE" });
        break;
      case CARD.FAVOR:
        dispatch({ type: "PLAY_FAVOR" });
        break;
      // REBOOT is not playable during normal flow (only after a Fatal draw)
      default:
        // Non-action cards are handled elsewhere
        break;
    }
  }

  function onResolveFatal() {
    dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
  }
  function onReinsert(posFromTop) {
    dispatch({ type: "REBOOT_INSERT", pos: posFromTop });
  }

  return (
    <div className="page">
      <h1 className="page-header">System Overload</h1>

      {/* Meta pills */}
      <div className="meta">
        <span className="pill">
          Players alive: {countAlive} / {game.players.length}
        </span>
        <span className="pill">
          Turn:
          <b style={{ marginLeft: 6 }}>{me?.name}</b>
          <span className="subtle" style={{ marginLeft: 6 }}>
            (Take {game.turnsToTake} turn{game.turnsToTake > 1 ? "s" : ""})
          </span>
        </span>
      </div>

      {/* Pass-Device modal */}
      <PrivacyScreen
        show={hideHand}
        playerName={me?.name}
        onContinue={() => setHideHand(false)}
      />

      {/* Deck / Discard */}
      <div className="deck-area">
        <div className="card deck-area__right">
          <DiscardPile cards={game.discard} maxToShow={10} />
        </div>
        <div className="card deck-area__left">
          <DeckCard
            count={game.deck.length}
            onClick={() => dispatch({ type: "DRAW" })}
            disabled={
              hideHand || game.phase !== PHASE.AWAIT_ACTION || !!game.drawnCard
            }
          />
          <div>
            <div style={{ fontSize: 60, fontWeight: 900, color: "red" }}>
              {game.deck.length}
            </div>
            <div className="section-title" style={{ color: "red" }}>
              Cards
              <br />
              Remain
              <br />
              ← Click
              <br />
              for your <br />
              FATE
            </div>
          </div>
        </div>
      </div>

      {/* Drawn card modal */}
      <Modal show={!!game.drawnCard}>
        {game.drawnCard && (
          <>
            <div className="modal-title">{game.drawnCard}</div>
            <div
              className="hstack"
              style={{ justifyContent: "center", margin: "10px 0" }}
            >
              <Card
                name={game.drawnCard}
                size="deck"
                disabled
                style={{
                  width: "calc(var(--card-deck-w) * 2)",
                  height: "calc(var(--card-deck-h) * 2)",
                }}
              />
            </div>
            <div className="subtle" style={{ marginBottom: 12 }}>
              {CARD_DESC[game.drawnCard]}
            </div>
            <Button onClick={() => dispatch({ type: "END_DRAW" })}>
              Close
            </Button>
          </>
        )}
      </Modal>

      {/* Health Check modal */}
      <Modal show={showPeekModal}>
        <div className="section-title">Health Check (top 3)</div>
        <div className="hstack" style={{ justifyContent: "center" }}>
          {[...game.peek].reverse().map((c, i) => (
            <div key={i} className="peek-card">
              <Card name={c} />
              <div className="peek-order">{i + 1}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Button
            onClick={() => {
              setShowPeekModal(false);
              dispatch({ type: "CLEAR_PEEK" });
            }}
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Fatal resolution */}
      <Modal show={game.phase === PHASE.RESOLVE_FATAL}>
        <div className="modal-title">{CARD.FATAL}!</div>
        <div
          className="hstack"
          style={{ justifyContent: "center", margin: "10px 0" }}
        >
          <Card
            name={CARD.FATAL}
            size="deck"
            disabled
            src={fatalCardSrc}
            style={{
              width: "calc(var(--card-deck-w) * 2)",
              height: "calc(var(--card-deck-h) * 2)",
            }}
          />
        </div>
        {hasReboot ? (
          <>
            <div className="subtle" style={{ marginBottom: 10 }}>
              Use {CARD.REBOOT} and choose where to put the Fatal back:
            </div>
            <div className="hstack" style={{ justifyContent: "center" }}>
              {Array.from({ length: game.deck.length + 1 }).map((_, pos) => (
                <Button
                  key={pos}
                  onClick={() => {
                    dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
                    onReinsert(pos);
                  }}
                >
                  {pos === 0
                    ? "Top"
                    : pos === game.deck.length
                    ? "Bottom"
                    : ordinal(pos + 1)}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="modal-title" style={{ fontSize: 40 }}>
              No {CARD.REBOOT} available! System Overload!
            </div>
            <Button onClick={onResolveFatal}>Continue</Button>
          </>
        )}
      </Modal>

      {/* Favor target selection */}
      <Modal show={game.phase === PHASE.CHOOSING_FAVOR}>
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
      </Modal>

      {/* Pair target selection */}
      <Modal show={game.phase === PHASE.CHOOSING_PAIR_TARGET}>
        <div className="section-title">
          Choose a player to steal a card from
        </div>
        <div className="hstack">
          {game.players
            .filter((p) => p.alive && p.id !== game.turn)
            .map((p) => (
              <Button
                key={p.id}
                onClick={() =>
                  dispatch({ type: "RESOLVE_PAIR_TARGET", toId: p.id })
                }
              >
                {p.name}
              </Button>
            ))}
        </div>
      </Modal>

      {/* Pair card selection */}
      <Modal
        show={
          game.phase === PHASE.CHOOSING_PAIR_CARD && game.comboTarget != null
        }
      >
        <div className="section-title">
          Choose a card from{" "}
          {game.comboTarget != null
            ? game.players[game.comboTarget].name
            : "selected player"}
        </div>
        <div className="hstack">
          {(game.comboTarget != null ? game.hands[game.comboTarget] : []).map(
            (_, i) => (
              <Card
                key={i}
                name="Hidden"
                faceDown
                allowClickWhenFaceDown
                onClick={() =>
                  dispatch({ type: "RESOLVE_PAIR_FROM", index: i })
                }
              />
            )
          )}
        </div>
      </Modal>

      {/* Triple target selection */}
      <Modal show={game.phase === PHASE.CHOOSING_TRIPLE_TARGET}>
        <div className="section-title">
          Choose a player to request a specific card from
        </div>
        <div className="hstack">
          {game.players
            .filter((p) => p.alive && p.id !== game.turn)
            .map((p) => (
              <Button
                key={p.id}
                onClick={() =>
                  dispatch({ type: "RESOLVE_TRIPLE_TARGET", toId: p.id })
                }
              >
                {p.name}
              </Button>
            ))}
        </div>
      </Modal>

      {/* Triple card selection */}
      <Modal
        show={
          game.phase === PHASE.CHOOSING_TRIPLE_CARD && game.comboTarget != null
        }
      >
        <div className="section-title">
          Request a card from{" "}
          {game.comboTarget != null
            ? game.players[game.comboTarget].name
            : "selected player"}
        </div>
        <div className="hstack" style={{ flexWrap: "wrap" }}>
          {REQUESTABLE_CARDS.map((n) => (
            <Card
              key={n}
              name={n}
              onClick={() =>
                dispatch({ type: "RESOLVE_TRIPLE_NAME", cardName: n })
              }
            />
          ))}
        </div>
      </Modal>

      {/* Card action modal */}
      <Modal show={selectedCard !== null}>
        {selectedCard && (
          <>
            <div className="section-title">{selectedCard}</div>
            <div
              className="hstack"
              style={{ justifyContent: "center", margin: "10px 0" }}
            >
              <Card
                name={selectedCard}
                size="deck"
                disabled
                style={{
                  width: "calc(var(--card-deck-w) * 2)",
                  height: "calc(var(--card-deck-h) * 2)",
                }}
              />
            </div>
            <div className="subtle" style={{ marginBottom: 12 }}>
              {CARD_DESC[selectedCard]}
            </div>
            {COMBO_CARDS.includes(selectedCard) && selectedCount < 2 && (
              <div className="subtle" style={{ marginBottom: 12 }}>
                This card must be paired to have available actions.
              </div>
            )}
            {selectedCard === CARD.REBOOT && (
              <div className="subtle" style={{ marginBottom: 12 }}>
                This card is only used to deactivate a Fatal Server Error when
                drawn. It cannot be played during your turn.
              </div>
            )}
            <div className="hstack" style={{ justifyContent: "center" }}>
              {isActionCard && (
                <Button
                  onClick={() => {
                    playCardByName(selectedCard);
                    setSelectedCard(null);
                  }}
                  disabled={!canPlaySelected}
                >
                  Play
                </Button>
              )}
              {COMBO_CARDS.includes(selectedCard) && (
                <>
                  <Button
                    onClick={() => {
                      dispatch({
                        type: "START_COMBO",
                        cardName: selectedCard,
                        mode: "PAIR",
                      });
                      setSelectedCard(null);
                    }}
                    disabled={!canPair}
                  >
                    Pair
                  </Button>
                  <Button
                    onClick={() => {
                      dispatch({
                        type: "START_COMBO",
                        cardName: selectedCard,
                        mode: "TRIPLE",
                      });
                      setSelectedCard(null);
                    }}
                    disabled={!canTriple}
                  >
                    Triple
                  </Button>
                </>
              )}
              <Button onClick={() => setSelectedCard(null)}>Cancel</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Hand */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">
          {me?.name} — Hand ({hand.length})
        </div>

        <div
          className="hstack"
          style={{ flexWrap: "wrap", columnGap: 0, rowGap: 8 }}
        >
          {groupedHand.map(({ card: c, count }, i) => {
            const canInspect =
              game.phase === PHASE.AWAIT_ACTION && !hideHand && !game.drawnCard;
            const isPlayable =
              canInspect &&
              (c === CARD.SKIP ||
                c === CARD.ATTACK ||
                c === CARD.SHUFFLE ||
                c === CARD.FUTURE ||
                c === CARD.FAVOR ||
                (COMBO_CARDS.includes(c) && count >= 2));
            const needsPair =
              canInspect && COMBO_CARDS.includes(c) && count < 2;
            const showInfo = needsPair || (canInspect && c === CARD.REBOOT);

            if (count === 1) {
              return (
                <Card
                  key={i}
                  name={c}
                  size="hand"
                  faceDown={hideHand}
                  onClick={() => setSelectedCard(c)}
                  disabled={!isPlayable}
                  onDisabledClick={
                    showInfo ? () => setSelectedCard(c) : undefined
                  }
                />
              );
            }

            return (
              <div
                className="hand-stack"
                key={i}
                style={{
                  "--stack-count": count,
                  "--stack-spacing": `${STACK_SPACING}px`,
                }}
              >
                {Array.from({ length: count }).map((_, j) => (
                  <Card
                    key={j}
                    name={c}
                    size="hand"
                    faceDown={hideHand}
                    onClick={() => setSelectedCard(c)}
                    disabled={!isPlayable}
                    onDisabledClick={
                      showInfo ? () => setSelectedCard(c) : undefined
                    }
                    style={{ "--stack-index": j }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Log with per-viewer visibility */}
      <div className="card">
        <div className="section-title">Game Log</div>
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
