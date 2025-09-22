import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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
import {
  chooseAction,
  chooseFavorTarget,
  choosePairTarget,
  choosePairIndex,
  chooseTripleTarget,
  chooseTripleCard,
} from "../bot/mlBot";
import "./Game.css"; // page styles (section boxes, layout, log, etc.)
import { isDevUiEnabled } from "../config";
import deckBack from "../assets/cards/SystemOverload.webp";

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
const BOT_SPEEDS = [100, 250, 500, 750, 1000, 1500, 2000, 3000];
const CARD_OVERLAY_FADE_MS = 180; // keep in sync with --dur-fade-quick in theme.css
const DRAW_OVERLAY_HOLD_MS = 3000;
const FATAL_OVERLAY_HOLD_MS = 60;

function initialState(playerDefs) {
  const { deck, hands } = createDeck(playerDefs.length);
  return {
    players: playerDefs.map((p, i) => ({
      id: i,
      name: typeof p === "string" ? p : p.name,
      alive: true,
      isBot: typeof p === "string" ? false : Boolean(p.isBot),
    })),
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
    // Messaging
    tripleFail: null, // { toId, cardName }

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
    // Dev-only helpers (no-ops unless dev UI enabled)
    case "DEV_GIVE_CARD": {
      if (!isDevUiEnabled()) return state;
      const pid = Number.isInteger(action.toId) ? action.toId : state.turn;
      const count = Math.max(1, action.count || 1);
      for (let i = 0; i < count; i++) S.hands[pid].push(action.cardName);
      S.log.push(
        `[dev] Gave ${count}x ${action.cardName} to ${S.players[pid].name}`
      );
      return S;
    }
    case "DEV_REMOVE_CARD": {
      if (!isDevUiEnabled()) return state;
      const pid = Number.isInteger(action.fromId) ? action.fromId : state.turn;
      const count = Math.max(1, action.count || 1);
      for (let i = 0; i < count; i++) {
        const idx = S.hands[pid].indexOf(action.cardName);
        if (idx !== -1) S.hands[pid].splice(idx, 1);
      }
      S.log.push(
        `[dev] Removed up to ${count}x ${action.cardName} from ${S.players[pid].name}`
      );
      return S;
    }
    case "DEV_NEXT_DRAW": {
      if (!isDevUiEnabled()) return state;
      const card = action.cardName || CARD.FATAL;
      S.deck.push(card); // push to top (end)
      S.log.push(`[dev] Inserted ${card} on top of the deck`);
      return S;
    }
    case "DEV_SET_TURN": {
      if (!isDevUiEnabled()) return state;
      const toId = action.toId;
      if (!Number.isInteger(toId) || toId < 0 || toId >= S.players.length)
        return state;
      S.turn = toId;
      S.log.push(`[dev] Turn set to ${S.players[toId].name}`);
      return S;
    }
    case "INIT": {
      const defs = action.players || action.names || [];
      return initialState(defs);
    }

    case "CLEAR_PEEK":
      S.peek = [];
      return S;

    case "DRAW": {
      // Guard: only allow draws during normal action phase and when no Fatal is pending reinsertion
      if (state.phase !== PHASE.AWAIT_ACTION || state.fatalCard) return state;
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
        S.tripleFail = { toId, cardName };
      }
      S.comboTarget = null;
      S.combo = null;
      S.phase = PHASE.AWAIT_ACTION;
      return S;
    }

    case "ACK_TRIPLE_FAIL": {
      S.tripleFail = null;
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
  // Support both legacy {names, bot} and new {players}
  const playersInput = (() => {
    if (Array.isArray(state?.players) && state.players.length)
      return state.players;
    const names = (state?.names || ["Player 1", "Player 2"]) // legacy support
      .map((s) => s.trim())
      .filter(Boolean);
    const lastIsBot = Boolean(state?.bot);
    return names.map((n, i) => ({
      name: n,
      isBot: lastIsBot && i === names.length - 1,
    }));
  })();

  const [game, dispatch] = useReducer(reducer, initialState(playersInput));
  const [hideHand, setHideHand] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showPeekModal, setShowPeekModal] = useState(false);
  const [flipFatal, setFlipFatal] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const botTurnStartLogIndexRef = useRef(0);
  const botIntervalRef = useRef(null);
  const pendingReinsertRef = useRef(null); // { pos }
  const botBusyRef = useRef(false); // gates bot while highlighting/sequencing
  const [botHighlight, setBotHighlight] = useState(null); // { type, ... }
  const [botSpeed, setBotSpeed] = useState(3); // 1..8 level (default 1500ms)
  const botTickMs = BOT_SPEEDS[botSpeed - 1] ?? 1000; // ms
  const botHighlightMs = Math.max(300, Math.floor(botTickMs * 0.6));
  const [showTurnReminder, setShowTurnReminder] = useState(false);
  const prevTurnInfoRef = useRef({ turn: 0, turnsToTake: 1 });
  const [isProMode, setIsProMode] = useState(false);
  const handAreaRef = useRef(null);
  const proModeOverlayRef = useRef(null);
  const selectedCardElementRef = useRef(null);
  const [proModeOverlay, setProModeOverlay] = useState(null); // { top, left, width, height }

  // Refs for draw animation (deck -> modal card)
  const deckAnchorRef = useRef(null);
  const drawnModalCardRef = useRef(null);
  const fatalModalCardRef = useRef(null);
  const [drawAnim, setDrawAnim] = useState(null); // { cardName, from, to, running, arrived, closing }
  const [fatalAnim, setFatalAnim] = useState(null); // { from, to, running, arrived, closing }
  // Refs to the fly-card overlays so we can force a reflow before starting transitions
  const drawFlyRef = useRef(null);
  const fatalFlyRef = useRef(null);
  const lastDeckRectRef = useRef(null);
  const [showRebootCover, setShowRebootCover] = useState(false);

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

  // Init once (support refresh during mount)
  useEffect(() => {
    dispatch({ type: "INIT", players: playersInput });
    setHideHand(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show pass-device modal only when the active turn actually changes (not for other state updates)
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;
    setHideHand(!isBot);
    // Bot pause screen between turns (2s), like human privacy screen
    botTurnStartLogIndexRef.current = game.log.length;
    if (isBot) {
      setShowBotModal(true);
      const t = setTimeout(() => {
        setShowBotModal(false);
      }, 2000);
      return () => clearTimeout(t);
    }
    setShowBotModal(false);
    setShowTurnReminder(false);
  }, [game.turn]);

  // Between-turn reminder for multi-turn sequences (same player, turns decreased)
  useEffect(() => {
    const prev = prevTurnInfoRef.current;
    const isSamePlayer = game.turn === prev.turn;
    const decreased = game.turnsToTake < prev.turnsToTake;
    const isHuman = !game.players[game.turn]?.isBot;
    if (isSamePlayer && decreased && game.turnsToTake >= 1 && isHuman) {
      setShowTurnReminder(true);
    }
    prevTurnInfoRef.current = {
      turn: game.turn,
      turnsToTake: game.turnsToTake,
    };
  }, [game.turn, game.turnsToTake, game.players]);

  // Show Health Check modal with top 3 cards and close after 3 seconds
  useEffect(() => {
    if (game.peek.length > 0) {
      setShowPeekModal(true);
      const timer = setTimeout(() => {
        setShowPeekModal(false);
        dispatch({ type: "CLEAR_PEEK" });
      }, 3000);
      return () => clearTimeout(timer);
    }
    setShowPeekModal(false);
  }, [game.peek]);

  // Clear pending bot reinsertion if it is no longer the bot's turn
  // Auto-close draw modal after 3 seconds
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;
    if (!isBot) pendingReinsertRef.current = null;
  }, [game.turn, game.players]);

  // Auto-close draw modal after 3 seconds (start when visible to user)
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;
    if (!game.drawnCard || isBot) return;
    // For deck draws (advanceAfterDraw), wait until flight/flip overlay arrives
    if (game.advanceAfterDraw) {
      // If an animation is running, wait until it arrives; if no animation, proceed.
      if (drawAnim && !drawAnim.arrived) return;
    }
    const timer = setTimeout(() => dispatch({ type: "END_DRAW" }), 3000);
    return () => clearTimeout(timer);
  }, [
    game.drawnCard,
    game.advanceAfterDraw,
    drawAnim?.arrived,
    game.turn,
    game.players,
  ]);

  // Launch deck->modal draw animation for human deck draws
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;
    if (!game.drawnCard || !game.advanceAfterDraw || isBot) {
      setDrawAnim(null);
      return;
    }

    // Compute start/end immediately; don't rely on modal being present.
    const deckEl = deckAnchorRef.current;
    const from = lastDeckRectRef.current || deckEl?.getBoundingClientRect();
    if (!from) return; // can't animate without a start rect

    // Prefer animating to the actual modal card if present (mounted hidden)
    const targetEl = drawnModalCardRef.current;
    let to;
    if (targetEl) {
      to = targetEl.getBoundingClientRect();
    } else {
      // Fallback: center-of-screen at 2x deck size
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const modalWVar = cs.getPropertyValue("--card-modal-w").trim();
      const modalHVar = cs.getPropertyValue("--card-modal-h").trim();
      const modalW = parseFloat(modalWVar);
      const modalH = parseFloat(modalHVar);
      const toWidth =
        Number.isFinite(modalW) && modalW > 0 ? modalW : from.width * 2;
      const toHeight =
        Number.isFinite(modalH) && modalH > 0 ? modalH : from.height * 2;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const toLeft = Math.max(0, (vw - toWidth) / 2);
      const toTop = Math.max(0, (vh - toHeight) / 2);
      to = { left: toLeft, top: toTop, width: toWidth, height: toHeight };
    }

    setDrawAnim({
      cardName: game.drawnCard,
      from,
      to,
      running: false,
      arrived: false,
      closing: false,
    });

    // Double RAF + layout read to force initial styles to commit before enabling transitions.
    let cancelled = false;
    let rafId = 0;
    const waitForElementThenRun = () => {
      if (cancelled) return;
      const el = drawFlyRef.current;
      // If modal target exists now, retarget to its exact rect before starting
      const target = drawnModalCardRef.current;
      if (target) {
        const rect = target.getBoundingClientRect();
        setDrawAnim((s) => (s ? { ...s, to: rect } : s));
      }
      if (!el) {
        rafId = requestAnimationFrame(waitForElementThenRun);
        return;
      }
      // Force a layout read so initial styles commit
      el.getBoundingClientRect();
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        setDrawAnim((s) => (s ? { ...s, running: true } : s));
      });
    };
    rafId = requestAnimationFrame(waitForElementThenRun);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.drawnCard, game.advanceAfterDraw, game.turn]);

  // Safety: ensure overlay is cleared if transitionend is missed
  useEffect(() => {
    if (drawAnim?.running && !drawAnim?.arrived) {
      let fadeTimer;
      const timer = setTimeout(() => {
        setDrawAnim((s) => {
          if (!s || s.closing) return s;
          return { ...s, closing: true };
        });
        fadeTimer = setTimeout(() => {
          setDrawAnim((s) => (s && s.closing ? null : s));
        }, CARD_OVERLAY_FADE_MS);
      }, 2400);
      return () => {
        clearTimeout(timer);
        if (fadeTimer) clearTimeout(fadeTimer);
      };
    }
  }, [drawAnim?.running, drawAnim?.arrived]);

  // Launch deck->modal fatal animation for human fatal draws
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;
    if (game.phase !== PHASE.RESOLVE_FATAL || isBot) {
      setFatalAnim(null);
      return;
    }

    const deckEl = deckAnchorRef.current;
    const from = lastDeckRectRef.current || deckEl?.getBoundingClientRect();
    if (!from) return; // can't animate without a start rect

    const targetEl = fatalModalCardRef.current;
    let to;
    if (targetEl) {
      to = targetEl.getBoundingClientRect();
    } else {
      const root = document.documentElement;
      const cs = getComputedStyle(root);
      const modalWVar = cs.getPropertyValue("--card-modal-w").trim();
      const modalHVar = cs.getPropertyValue("--card-modal-h").trim();
      const modalW = parseFloat(modalWVar);
      const modalH = parseFloat(modalHVar);
      const toWidth =
        Number.isFinite(modalW) && modalW > 0 ? modalW : from.width * 2;
      const toHeight =
        Number.isFinite(modalH) && modalH > 0 ? modalH : from.height * 2;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const toLeft = Math.max(0, (vw - toWidth) / 2);
      const toTop = Math.max(0, (vh - toHeight) / 2);
      to = { left: toLeft, top: toTop, width: toWidth, height: toHeight };
    }

    setFatalAnim({ from, to, running: false, arrived: false, closing: false });

    let cancelled = false;
    let rafId = 0;
    const waitForElementThenRun = () => {
      if (cancelled) return;
      const el = fatalFlyRef.current;
      const target = fatalModalCardRef.current;
      if (target) {
        const rect = target.getBoundingClientRect();
        setFatalAnim((s) => (s ? { ...s, to: rect } : s));
      }
      if (!el) {
        rafId = requestAnimationFrame(waitForElementThenRun);
        return;
      }
      el.getBoundingClientRect();
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        setFatalAnim((s) => (s ? { ...s, running: true } : s));
      });
    };
    rafId = requestAnimationFrame(waitForElementThenRun);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.turn]);

  // Safety: ensure fatal overlay is cleared if transitionend is missed
  useEffect(() => {
    if (fatalAnim?.running && !fatalAnim?.arrived) {
      let fadeTimer;
      const timer = setTimeout(() => {
        setFatalAnim((s) => {
          if (!s || s.closing) return s;
          return { ...s, closing: true };
        });
        fadeTimer = setTimeout(() => {
          setFatalAnim((s) => (s && s.closing ? null : s));
        }, CARD_OVERLAY_FADE_MS);
      }, 2400);
      return () => {
        clearTimeout(timer);
        if (fadeTimer) clearTimeout(fadeTimer);
      };
    }
  }, [fatalAnim?.running, fatalAnim?.arrived]);

  // Bot logic (throttled; paused during 2s turn-start modal and while highlighting)
  useEffect(() => {
    const isBot = game.players[game.turn]?.isBot;

    // Clear any previous interval when turn changes or when not a bot
    if (!isBot || showBotModal) {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
      return;
    }

    // Start a ticking interval that performs at most one action per tick
    if (!botIntervalRef.current) {
      botIntervalRef.current = setInterval(() => {
        if (botBusyRef.current) return; // wait until current action completes
        // Capture live game state via closure from latest render
        // 1) If we owe a REBOOT reinsertion, do that first.
        if (pendingReinsertRef.current) {
          const { pos } = pendingReinsertRef.current;
          // highlight then perform reinsert after short delay
          botBusyRef.current = true;
          setBotHighlight({ type: "fatal_pos", pos });
          setTimeout(() => {
            pendingReinsertRef.current = null;
            dispatch({ type: "REBOOT_INSERT", pos });
            setBotHighlight(null);
            botBusyRef.current = false;
          }, botHighlightMs);
          return; // one action this tick
        }

        const current = game; // latest props in closure due to dependency below
        const pid = current.turn;
        const handNow = current.hands[pid] || [];

        if (current.drawnCard) {
          // Finish draw animations/modals
          dispatch({ type: "END_DRAW" });
          return;
        }

        if (current.phase === PHASE.RESOLVE_FATAL) {
          if (handNow.includes(CARD.REBOOT)) {
            // Step 1: use Reboot (removes it), Step 2 next tick: reinsert Fatal
            dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
            const pos = Math.floor(Math.random() * (current.deck.length + 1));
            pendingReinsertRef.current = { pos };
          } else {
            // No reboot, explode
            dispatch({ type: "USE_REBOOT_OR_EXPLODE" });
          }
          return;
        }

        if (current.phase === PHASE.CHOOSING_FAVOR) {
          const toId = chooseFavorTarget(current);
          if (toId != null) {
            botBusyRef.current = true;
            setBotHighlight({ type: "player", playerId: toId });
            setTimeout(() => {
              dispatch({ type: "RESOLVE_FAVOR_FROM", toId });
              setBotHighlight(null);
              botBusyRef.current = false;
            }, botHighlightMs);
          }
          return;
        }

        if (current.phase === PHASE.CHOOSING_PAIR_TARGET) {
          const toId = choosePairTarget(current);
          if (toId != null) {
            botBusyRef.current = true;
            setBotHighlight({ type: "player", playerId: toId });
            setTimeout(() => {
              dispatch({ type: "RESOLVE_PAIR_TARGET", toId });
              setBotHighlight(null);
              botBusyRef.current = false;
            }, botHighlightMs);
          }
          return;
        }

        if (
          current.phase === PHASE.CHOOSING_PAIR_CARD &&
          current.comboTarget != null
        ) {
          const index = choosePairIndex(current);
          botBusyRef.current = true;
          setBotHighlight({ type: "pair_card", index });
          setTimeout(() => {
            dispatch({ type: "RESOLVE_PAIR_FROM", index });
            setBotHighlight(null);
            botBusyRef.current = false;
          }, botHighlightMs);
          return;
        }

        if (current.phase === PHASE.CHOOSING_TRIPLE_TARGET) {
          const toId = chooseTripleTarget(current);
          if (toId != null) {
            botBusyRef.current = true;
            setBotHighlight({ type: "player", playerId: toId });
            setTimeout(() => {
              dispatch({ type: "RESOLVE_TRIPLE_TARGET", toId });
              setBotHighlight(null);
              botBusyRef.current = false;
            }, botHighlightMs);
          }
          return;
        }

        if (
          current.phase === PHASE.CHOOSING_TRIPLE_CARD &&
          current.comboTarget != null
        ) {
          const cardName = chooseTripleCard(current);
          botBusyRef.current = true;
          setBotHighlight({ type: "triple_card", cardName });
          setTimeout(() => {
            dispatch({ type: "RESOLVE_TRIPLE_NAME", cardName });
            setBotHighlight(null);
            botBusyRef.current = false;
          }, botHighlightMs);
          return;
        }

        if (current.phase === PHASE.AWAIT_ACTION) {
          const decision = chooseAction(current);
          const highlightAndDispatch = (hl, act) => {
            botBusyRef.current = true;
            if (hl) setBotHighlight(hl);
            setTimeout(() => {
              dispatch(act);
              if (hl) setBotHighlight(null);
              botBusyRef.current = false;
            }, botHighlightMs);
          };
          switch (decision?.type) {
            case "PLAY_SKIP":
              return highlightAndDispatch(
                { type: "hand_card", cardName: CARD.SKIP },
                { type: "PLAY_SKIP" }
              );
            case "PLAY_ATTACK":
              return highlightAndDispatch(
                { type: "hand_card", cardName: CARD.ATTACK },
                { type: "PLAY_ATTACK" }
              );
            case "PLAY_SHUFFLE":
              return highlightAndDispatch(
                { type: "hand_card", cardName: CARD.SHUFFLE },
                { type: "PLAY_SHUFFLE" }
              );
            case "PLAY_FUTURE":
              return highlightAndDispatch(
                { type: "hand_card", cardName: CARD.FUTURE },
                { type: "PLAY_FUTURE" }
              );
            case "PLAY_FAVOR":
              return highlightAndDispatch(
                { type: "hand_card", cardName: CARD.FAVOR },
                { type: "PLAY_FAVOR" }
              );
            case "PLAY_PAIR":
              if (decision.cardName) {
                return highlightAndDispatch(
                  { type: "hand_card", cardName: decision.cardName },
                  {
                    type: "START_COMBO",
                    cardName: decision.cardName,
                    mode: "PAIR",
                  }
                );
              }
            // fallthrough to DRAW if no card name
            case "PLAY_TRIPLE":
              if (decision.cardName) {
                return highlightAndDispatch(
                  { type: "hand_card", cardName: decision.cardName },
                  {
                    type: "START_COMBO",
                    cardName: decision.cardName,
                    mode: "TRIPLE",
                  }
                );
              }
            // fallthrough
            case "DRAW":
            default:
              return highlightAndDispatch({ type: "deck" }, { type: "DRAW" });
          }
          return;
        }
      }, botTickMs);
    }

    // Cleanup when dependencies change (keep pendingReinsert across ticks)
    return () => {
      if (botIntervalRef.current) {
        clearInterval(botIntervalRef.current);
        botIntervalRef.current = null;
      }
    };
  }, [
    game.turn,
    game.players,
    game.phase,
    game.drawnCard,
    game.deck.length,
    game.hands,
    dispatch,
    showBotModal,
    botTickMs,
  ]);

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

  // Delay and animate showing the Reboot cover when available
  useEffect(() => {
    if (game.phase === PHASE.RESOLVE_FATAL && hasReboot) {
      setShowRebootCover(false);
      const t = setTimeout(() => setShowRebootCover(true), 2000);
      return () => clearTimeout(t);
    }
    setShowRebootCover(false);
  }, [game.phase, hasReboot]);

  const fatalTitleText = (() => {
    if (game.phase !== PHASE.RESOLVE_FATAL) return `${CARD.FATAL}!`;
    if (hasReboot) return `${CARD.FATAL}!`;
    // No reboot available: flip text in sync with card image
    return flipFatal ? "System Overload" : `${CARD.FATAL}!`;
  })();

  const fatalTitleStyle =
    game.phase === PHASE.RESOLVE_FATAL ? { color: "var(--danger)" } : undefined;

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
    selectedCard &&
    selectedCard !== CARD.REBOOT &&
    selectedCard !== CARD.FATAL &&
    selectedCount >= 2 &&
    canPlayNow;
  const canTriple =
    selectedCard &&
    selectedCard !== CARD.REBOOT &&
    selectedCard !== CARD.FATAL &&
    selectedCount >= 3 &&
    canPlayNow;

  const resetSelectedCard = useCallback(() => {
    setSelectedCard(null);
    setProModeOverlay(null);
    selectedCardElementRef.current = null;
  }, []);

  const updateProModeOverlayPosition = useCallback(() => {
    if (!isProMode) return;
    const container = handAreaRef.current;
    const cardEl = selectedCardElementRef.current;
    if (!container || !cardEl) return;
    const containerRect = container.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    setProModeOverlay({
      top: cardRect.top - containerRect.top,
      left: cardRect.left - containerRect.left,
      width: cardRect.width,
      height: cardRect.height,
    });
  }, [isProMode]);

  const handleCardClick = useCallback(
    (cardName, event) => {
      const target = event?.currentTarget || null;
      if (isProMode && cardName === CARD.REBOOT) {
        return;
      }
      setSelectedCard(cardName);
      if (isProMode && target) {
        selectedCardElementRef.current = target;
        updateProModeOverlayPosition();
      } else {
        selectedCardElementRef.current = target;
        setProModeOverlay(null);
      }
    },
    [isProMode, updateProModeOverlayPosition]
  );

  useEffect(() => {
    if (hideHand) {
      resetSelectedCard();
    }
  }, [hideHand, resetSelectedCard]);

  useEffect(() => {
    if (!selectedCard) return;
    if (!hand.includes(selectedCard)) {
      resetSelectedCard();
    }
  }, [hand, selectedCard, resetSelectedCard]);

  useEffect(() => {
    if (!isProMode || !selectedCard || !proModeOverlay) return;

    const handlePointerDown = (event) => {
      const overlayEl = proModeOverlayRef.current;
      const cardEl = selectedCardElementRef.current;
      if (!overlayEl) return;
      const target = event.target;
      const isNode = typeof Node !== "undefined" && target instanceof Node;
      if (isNode && overlayEl.contains(target)) return;
      if (isNode && cardEl && cardEl.contains(target)) return;
      resetSelectedCard();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isProMode, selectedCard, proModeOverlay, resetSelectedCard]);

  useEffect(() => {
    if (!isProMode || !selectedCard || !proModeOverlay) return;

    const handleWindowChange = () => {
      updateProModeOverlayPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);
    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isProMode, selectedCard, proModeOverlay, updateProModeOverlayPosition]);

  useEffect(() => {
    if (!isProMode || !selectedCard) return;
    updateProModeOverlayPosition();
  }, [isProMode, selectedCard, updateProModeOverlayPosition]);

  function handlePlaySelected() {
    if (!selectedCard) return;
    playCardByName(selectedCard);
    resetSelectedCard();
  }

  function handleStartCombo(mode) {
    if (!selectedCard) return;
    dispatch({
      type: "START_COMBO",
      cardName: selectedCard,
      mode,
    });
    resetSelectedCard();
  }

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

  // Dev helpers (UI gating only)
  const devEnabled = isDevUiEnabled();
  const otherPlayers = game.players
    .map((p, i) => ({ ...p, id: i }))
    .filter((p) => p.id !== game.turn && p.alive);
  const ensureCardThen = (cardName, fn) => {
    if (!game.hands[game.turn].includes(cardName)) {
      dispatch({ type: "DEV_GIVE_CARD", cardName });
    }
    fn();
  };

  return (
    <div className="page">
      <h1 className="page-header">System-Overload</h1>

      {/* Meta pills */}
      <div className="meta">
        <span className="badge">Local</span>
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
        <span
          className="pill"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontWeight: 700 }}>Pro</span>
          <Button
            type="button"
            kind={isProMode ? "success" : "ghost"}
            onClick={() => {
              setIsProMode((prev) => !prev);
              resetSelectedCard();
            }}
            aria-pressed={isProMode}
            style={{ padding: "6px 12px" }}
          >
            {isProMode ? "On" : "Off"}
          </Button>
        </span>
        {game.players.some((p) => p.isBot) &&
          (() => {
            const level = botSpeed; // 1..8
            const maxLevel = BOT_SPEEDS.length; // 8
            const t = (level - 1) / (maxLevel - 1); // 0..1
            // Map 0..1 to red(0) -> green(120): lower -> higher
            const hue = Math.round(t * 120);
            const bg = `hsl(${hue} 80% 40%)`;
            return (
              <span
                className="pill"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ fontWeight: 700 }}>Bot Speed</span>
                <button
                  className="btn btn-ghost"
                  aria-label="Slower"
                  title="Slower"
                  onClick={() => setBotSpeed((s) => Math.max(1, s - 1))}
                  disabled={botSpeed <= 1}
                  style={{ padding: "4px 8px" }}
                >
                  ◀
                </button>
                <div
                  role="meter"
                  aria-valuemin={1}
                  aria-valuemax={maxLevel}
                  aria-valuenow={level}
                  title={`Bot speed: level ${level} (${botTickMs}ms)`}
                  style={{
                    width: 120,
                    height: 24,
                    borderRadius: 6,
                    background: bg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    letterSpacing: 0.3,
                  }}
                >
                  {botTickMs}ms
                </div>
                <button
                  className="btn btn-ghost"
                  aria-label="Faster"
                  title="Faster"
                  onClick={() => setBotSpeed((s) => Math.min(maxLevel, s + 1))}
                  disabled={botSpeed >= maxLevel}
                  style={{ padding: "4px 8px" }}
                >
                  ▶
                </button>
              </span>
            );
          })()}
      </div>

      {/* Dev Tools Panel */}
      {devEnabled && (
        <div
          style={{
            margin: "8px 0 16px",
            padding: 12,
            border: "1px dashed #bbb",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Dev Tools</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              className="btn"
              onClick={() =>
                dispatch({ type: "DEV_NEXT_DRAW", cardName: CARD.FATAL })
              }
            >
              Next Draw = Fatal
            </button>
            <button className="btn" onClick={() => dispatch({ type: "DRAW" })}>
              Draw Now
            </button>
            {game.players.map((p, i) => (
              <button
                key={i}
                className="btn"
                onClick={() => dispatch({ type: "DEV_SET_TURN", toId: i })}
              >
                Set Turn → {p.name}
              </button>
            ))}
            {[
              CARD.REBOOT,
              CARD.SKIP,
              CARD.ATTACK,
              CARD.SHUFFLE,
              CARD.FUTURE,
              CARD.FAVOR,
            ].map((c) => (
              <button
                key={c}
                className="btn"
                onClick={() => dispatch({ type: "DEV_GIVE_CARD", cardName: c })}
              >
                Give {c}
              </button>
            ))}
          </div>
          <div
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            <button
              className="btn"
              onClick={() =>
                ensureCardThen(CARD.FAVOR, () =>
                  dispatch({ type: "PLAY_FAVOR" })
                )
              }
            >
              Start Favor
            </button>
            {game.phase === PHASE.CHOOSING_FAVOR &&
              otherPlayers.map((p) => (
                <button
                  key={p.id}
                  className="btn"
                  onClick={() =>
                    dispatch({ type: "RESOLVE_FAVOR_FROM", toId: p.id })
                  }
                >
                  Favor → {p.name}
                </button>
              ))}
          </div>
          <div
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}
          >
            {/* Start Pair/Triple by seeding required duplicates */}
            {COMBO_CARDS.map((c) => (
              <span
                key={c}
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                <span style={{ fontSize: 12, color: "#444" }}>{c}</span>
                <button
                  className="btn"
                  onClick={() => {
                    dispatch({ type: "DEV_GIVE_CARD", cardName: c, count: 2 });
                    dispatch({
                      type: "START_COMBO",
                      mode: "PAIR",
                      cardName: c,
                    });
                  }}
                >
                  Pair
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    dispatch({ type: "DEV_GIVE_CARD", cardName: c, count: 3 });
                    dispatch({
                      type: "START_COMBO",
                      mode: "TRIPLE",
                      cardName: c,
                    });
                  }}
                >
                  Triple
                </button>
              </span>
            ))}
          </div>
          {game.phase === PHASE.CHOOSING_PAIR_TARGET && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  className="btn"
                  onClick={() =>
                    dispatch({ type: "RESOLVE_PAIR_TARGET", toId: p.id })
                  }
                >
                  Pair target → {p.name}
                </button>
              ))}
            </div>
          )}
          {game.phase === PHASE.CHOOSING_PAIR_CARD &&
            game.comboTarget != null && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {(game.hands[game.comboTarget] || []).map((_, idx) => (
                  <button
                    key={idx}
                    className="btn"
                    onClick={() =>
                      dispatch({ type: "RESOLVE_PAIR_FROM", index: idx })
                    }
                  >
                    Take index {idx}
                  </button>
                ))}
              </div>
            )}
          {game.phase === PHASE.CHOOSING_TRIPLE_TARGET && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {otherPlayers.map((p) => (
                <button
                  key={p.id}
                  className="btn"
                  onClick={() =>
                    dispatch({ type: "RESOLVE_TRIPLE_TARGET", toId: p.id })
                  }
                >
                  Triple target → {p.name}
                </button>
              ))}
            </div>
          )}
          {game.phase === PHASE.CHOOSING_TRIPLE_CARD && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {COMBO_CARDS.map((c) => (
                <button
                  key={c}
                  className="btn"
                  onClick={() =>
                    dispatch({ type: "RESOLVE_TRIPLE_NAME", cardName: c })
                  }
                >
                  Name {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pass-Device modal */}
      <PrivacyScreen
        show={hideHand}
        playerName={me?.name}
        turnsToTake={game.turnsToTake}
        onContinue={() => setHideHand(false)}
      />

      {/* Between-turn reminder for multi-turn sequences */}
      <Modal
        show={showTurnReminder}
        onClose={() => setShowTurnReminder(false)}
        dismissOnClick
      >
        <div className="modal-title">WAIT!</div>
        <div className="section-title" style={{ marginBottom: 12 }}>
          You have {game.turnsToTake} more{" "}
          {game.turnsToTake === 1 ? "turn" : "turns"} to take!
        </div>
        <div className="subtle" style={{ marginTop: 12 }}>
          Click anywhere to continue
        </div>
      </Modal>

      {/* Deck / Discard */}
      <div className="deck-area">
        <div className="card deck-area__right">
          <DiscardPile cards={game.discard} maxToShow={10} />
        </div>
        <div className="card deck-area__left">
          <div
            style={
              botHighlight?.type === "deck"
                ? {
                    outline: "4px solid var(--accent)",
                    borderRadius: 12,
                    padding: 2,
                    display: "inline-block",
                  }
                : undefined
            }
          >
            <DeckCard
              count={game.deck.length}
              anchorRef={deckAnchorRef}
              onClick={() => {
                if (!me?.isBot && !game.fatalCard) {
                  const d = deckAnchorRef.current;
                  if (d) lastDeckRectRef.current = d.getBoundingClientRect();
                  dispatch({ type: "DRAW" });
                }
              }}
              disabled={
                hideHand ||
                me?.isBot ||
                game.phase !== PHASE.AWAIT_ACTION ||
                !!game.fatalCard ||
                !!game.drawnCard
              }
            />
          </div>
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

      {/* Drawn card modal (hidden during bot turns) */}
      <Modal
        show={!!game.drawnCard && !game.players[game.turn]?.isBot}
        className={`modal--drawn${
          game.advanceAfterDraw && drawAnim && !drawAnim.arrived
            ? " modal--pre"
            : ""
        }`}
        onClose={() => dispatch({ type: "END_DRAW" })}
        dismissOnClick
      >
        {game.drawnCard && (
          <>
            <div className="modal-title">Success!</div>
            <div
              className="hstack modal-card drawn-modal-card"
              style={{ justifyContent: "center" }}
            >
              <span ref={drawnModalCardRef} style={{ display: "inline-block" }}>
                <Card
                  name={game.drawnCard}
                  size="modal"
                  disabled
                  variant="modal"
                  // style={{
                  //   // Show underlying modal card as soon as the fly-in arrives
                  //   opacity: drawAnim && !drawAnim.arrived ? 0 : 1,
                  //   transition:
                  //     "opacity var(--dur-fade-quick) var(--ease-emph)",
                  // }}
                />
              </span>
            </div>
            <div
              className="section-title multiline card-desc modal-desc"
              style={{ marginBottom: 2 }}
            >
              {CARD_DESC[game.drawnCard]}
            </div>
            <div className="subtle" style={{ marginBottom: 2 }}>
              Click anywhere to exit
            </div>
            {/* <Button onClick={() => dispatch({ type: "END_DRAW" })}>
              Close
            </Button> */}
          </>
        )}
      </Modal>

      {/* Flying draw card animation overlay */}
      {drawAnim &&
        (() => {
          const { from, to, running, closing } = drawAnim;
          const target = to ?? from;
          const dx = target.left - from.left;
          const dy = target.top - from.top;
          const nudgeY = -3; // slight upward adjustment to align with modal
          const targetWidth = target.width || from.width;
          const targetHeight = target.height || from.height;
          const startScale =
            targetWidth > 0 && targetHeight > 0 ? from.width / targetWidth : 1;
          const start = `translate(${from.left}px, ${from.top}px) scale(${startScale})`;
          const end = `translate(${from.left + dx}px, ${
            from.top + dy + nudgeY
          }px) scale(1)`;
          return (
            <div
              ref={drawFlyRef}
              className={`fly-card${running ? " is-running" : ""}${
                closing ? " is-closing" : ""
              }`}
              style={{
                width: `${targetWidth}px`,
                height: `${targetHeight}px`,
                transform: running ? end : start,
              }}
              onTransitionEnd={(e) => {
                // Only react to the container's transform transition end
                if (
                  e.target !== e.currentTarget ||
                  e.propertyName !== "transform"
                )
                  return;
                // Mark arrival so modal can show while overlay holds position
                setDrawAnim((s) => (s ? { ...s, arrived: true } : s));
                // Keep the overlay in place briefly so the modal can fade in, then ease it out.
                setTimeout(() => {
                  setDrawAnim((s) => {
                    if (!s || s.closing) return s;
                    return { ...s, closing: true };
                  });
                  setTimeout(() => {
                    setDrawAnim((s) => (s && s.closing ? null : s));
                  }, CARD_OVERLAY_FADE_MS);
                }, DRAW_OVERLAY_HOLD_MS);
              }}
            >
              <div className={`fly-card__inner${running ? " is-running" : ""}`}>
                <img
                  className="fly-card__face face--back"
                  src={deckBack}
                  alt="Deck back"
                />
                <img
                  className="fly-card__face face--front"
                  src={CARD_IMG[drawAnim.cardName] || deckBack}
                  alt={drawAnim.cardName}
                />
              </div>
            </div>
          );
        })()}

      {/* Health Check modal (hidden during bot turns) */}
      <Modal
        show={showPeekModal && !game.players[game.turn]?.isBot}
        onClose={() => {
          setShowPeekModal(false);
          dispatch({ type: "CLEAR_PEEK" });
        }}
      >
        <div className="section-title">
          Health Check (top 3 cards from the deck)
        </div>
        <div className="hstack" style={{ justifyContent: "center" }}>
          {[...game.peek].reverse().map((c, i) => (
            <div key={i} className="peek-card">
              <Card name={c} disabled variant="modal" />
              <div className="peek-order">{i + 1}</div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Fatal resolution */}
      <Modal
        show={game.phase === PHASE.RESOLVE_FATAL}
        className={`modal--drawn${
          !game.players[game.turn]?.isBot && fatalAnim && !fatalAnim.arrived
            ? " modal--pre"
            : ""
        }`}
      >
        <div className="modal-title" style={fatalTitleStyle}>
          {fatalTitleText}
        </div>
        <div
          className="hstack modal-card drawn-modal-card"
          style={{ justifyContent: "center", margin: "10px 0" }}
        >
          <span style={{ display: "inline-block" }}>
            <div
              ref={fatalModalCardRef}
              className={`flip-card${
                // When a Reboot is available, show the front (Fatal) without cycling.
                hasReboot ? " is-flipped" : flipFatal ? "" : " is-flipped"
              }`}
              // style={{
              //   // Show underlying modal card as soon as the fly-in arrives
              //   opacity: fatalAnim && !fatalAnim.arrived ? 0 : 1,
              //   transition: "opacity var(--dur-fade-quick) var(--ease-emph)",
              // }}
            >
              <div className="flip-card__inner">
                <img
                  className="flip-card__face face--back"
                  src={deckBack}
                  alt="Deck back"
                />
                <img
                  className="flip-card__face face--front"
                  src={CARD_IMG[CARD.FATAL]}
                  alt={CARD.FATAL}
                />
              </div>
              {hasReboot && showRebootCover && (
                <img
                  className="reboot-cover animate-in"
                  src={CARD_IMG[CARD.REBOOT]}
                  alt={CARD.REBOOT}
                />
              )}
            </div>
          </span>
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
                  style={
                    botHighlight?.type === "fatal_pos" &&
                    botHighlight.pos === pos
                      ? { outline: "4px solid var(--accent)" }
                      : undefined
                  }
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
            <div className="modal-title" style={fatalTitleStyle}>
              {CARD.REBOOT} Unavailable! System Overload!
            </div>
            <Button onClick={onResolveFatal}>Continue</Button>
          </>
        )}
      </Modal>

      {/* Flying fatal card animation overlay */}
      {fatalAnim &&
        (() => {
          const { from, to, running, closing } = fatalAnim;
          const target = to ?? from;
          const dx = target.left - from.left;
          const dy = target.top - from.top;
          const nudgeY = 0; // slight upward adjustment to align with modal
          const targetWidth = target.width || from.width;
          const targetHeight = target.height || from.height;
          const startScale =
            targetWidth > 0 && targetHeight > 0 ? from.width / targetWidth : 1;
          const start = `translate(${from.left}px, ${from.top}px) scale(${startScale})`;
          const end = `translate(${from.left + dx}px, ${
            from.top + dy + nudgeY
          }px) scale(1)`;
          return (
            <div
              ref={fatalFlyRef}
              className={`fly-card${running ? " is-running" : ""}${
                closing ? " is-closing" : ""
              }`}
              style={{
                width: `${targetWidth}px`,
                height: `${targetHeight}px`,
                transform: running ? end : start,
              }}
              onTransitionEnd={(e) => {
                // Only react to the container's transform transition end
                if (
                  e.target !== e.currentTarget ||
                  e.propertyName !== "transform"
                )
                  return;
                // Mark arrival so modal can show while overlay holds position
                setFatalAnim((s) => (s ? { ...s, arrived: true } : s));
                // Keep the overlay just long enough to cover the modal fade-in, then fade it away.
                setTimeout(() => {
                  setFatalAnim((s) => {
                    if (!s || s.closing) return s;
                    return { ...s, closing: true };
                  });
                  setTimeout(() => {
                    setFatalAnim((s) => (s && s.closing ? null : s));
                  }, CARD_OVERLAY_FADE_MS);
                }, FATAL_OVERLAY_HOLD_MS);
              }}
            >
              <div className={`fly-card__inner${running ? " is-running" : ""}`}>
                <img
                  className="fly-card__face face--back"
                  src={deckBack}
                  alt="Deck back"
                />
                <img
                  className="fly-card__face face--front"
                  src={CARD_IMG[CARD.FATAL] || deckBack}
                  alt={CARD.FATAL}
                />
              </div>
            </div>
          );
        })()}

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
                style={
                  botHighlight?.type === "player" &&
                  botHighlight.playerId === p.id
                    ? { outline: "4px solid var(--accent)" }
                    : undefined
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
                style={
                  botHighlight?.type === "player" &&
                  botHighlight.playerId === p.id
                    ? { outline: "4px solid var(--accent)" }
                    : undefined
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
                variant="modal"
                style={
                  botHighlight?.type === "pair_card" && botHighlight.index === i
                    ? {
                        outline: "4px solid var(--accent)",
                        borderRadius: 12,
                        "--modal-card-radius": "12px",
                        padding: 2,
                        display: "inline-block",
                      }
                    : undefined
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
                style={
                  botHighlight?.type === "player" &&
                  botHighlight.playerId === p.id
                    ? { outline: "4px solid var(--accent)" }
                    : undefined
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
              variant="modal"
              style={
                botHighlight?.type === "triple_card" &&
                botHighlight.cardName === n
                  ? {
                      outline: "4px solid var(--accent)",
                      borderRadius: 12,
                      "--modal-card-radius": "12px",
                      padding: 2,
                      display: "inline-block",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </Modal>

      {/* Bot Playing modal */}
      <Modal show={showBotModal}>
        {(() => {
          const bot = game.players[game.turn];
          const start = botTurnStartLogIndexRef.current;
          // Filter current turn log entries that belong to this bot
          const turnEntries = game.log.slice(start);
          const entries = turnEntries.filter((entry) => {
            const text = typeof entry === "string" ? entry : entry.text || "";
            return bot && text.includes(bot.name);
          });
          const botNumber = bot
            ? game.players
                .filter((p) => p.isBot)
                .findIndex((p) => p.id === bot.id) + 1
            : null;
          return (
            <>
              <div className="section-title">
                {bot.name ? `${bot.name} (bot) Thinking...` : "Bot Playing"}
              </div>
              <ul className="list scroll"></ul>
            </>
          );
        })()}
      </Modal>

      {/* Triple failure modal */}
      <Modal
        show={!!game.tripleFail}
        onClose={() => dispatch({ type: "ACK_TRIPLE_FAIL" })}
        dismissOnClick
      >
        {game.tripleFail && (
          <>
            <div className="modal-title">Failure!</div>
            <div
              className="section-title multiline card-desc"
              style={{ marginBottom: 12 }}
            >
              Request failed: {game.players[game.tripleFail.toId].name} does not
              have {game.tripleFail.cardName}.
            </div>
            <div className="subtle" style={{ marginTop: 12 }}>
              Click anywhere to exit
            </div>
          </>
        )}
      </Modal>

      {/* Card action modal */}
      <Modal
        show={selectedCard !== null && !isProMode}
        onClose={resetSelectedCard}
        dismissOnClick
      >
        {selectedCard && (
          <>
            {/* <div className="section-title">{selectedCard}</div> */}
            {/* <div
              className="hstack modal-card"
              style={{ justifyContent: "center" }}
            > */}
            <Card name={selectedCard} size="modal" disabled />
            {/* </div> */}
            <div
              className="section-title multiline card-desc modal-desc"
              style={{ marginBottom: 12 }}
            >
              {CARD_DESC[selectedCard]}
            </div>
            {/* {COMBO_CARDS.includes(selectedCard) && selectedCount < 2 && (
              <div className="section-title" style={{ marginBottom: 12 }}>
                This card must be paired to have available actions.
              </div>
            )} */}
            {selectedCard === CARD.REBOOT && (
              <div className="section-title" style={{ marginBottom: 2 }}>
                It cannot be played during your turn.
              </div>
            )}
            <div className="hstack" style={{ justifyContent: "center" }}>
              {isActionCard && selectedCard !== CARD.REBOOT && (
                <Button
                  onClick={handlePlaySelected}
                  disabled={!canPlaySelected}
                >
                  Play
                </Button>
              )}
              {selectedCard !== CARD.REBOOT && selectedCard !== CARD.FATAL && (
                <>
                  <Button
                    onClick={() => handleStartCombo("PAIR")}
                    disabled={!canPair}
                  >
                    Pair
                  </Button>
                  <Button
                    onClick={() => handleStartCombo("TRIPLE")}
                    disabled={!canTriple}
                  >
                    Triple
                  </Button>
                </>
              )}
            </div>
            <div className="subtle" style={{ marginTop: 2 }}>
              Click anywhere to exit
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
          ref={handAreaRef}
          style={{
            flexWrap: "wrap",
            columnGap: 10,
            rowGap: 8,
            position: "relative",
          }}
        >
          {groupedHand.map(({ card: c, count }, i) => {
            const canInspect =
              game.phase === PHASE.AWAIT_ACTION &&
              !hideHand &&
              !me?.isBot &&
              !game.drawnCard &&
              // Disable selecting cards while Health Check modal is open
              !showPeekModal;
            const isPlayable =
              canInspect &&
              (c === CARD.SKIP ||
                c === CARD.ATTACK ||
                c === CARD.SHUFFLE ||
                c === CARD.FUTURE ||
                c === CARD.FAVOR ||
                // Allow pairing/tripling any non-Reboot/Fatal with 2+
                (count >= 2 && c !== CARD.REBOOT && c !== CARD.FATAL));
            const needsPair =
              canInspect &&
              // Non-action cards that need pairs to do anything
              !(
                c === CARD.SKIP ||
                c === CARD.ATTACK ||
                c === CARD.SHUFFLE ||
                c === CARD.FUTURE ||
                c === CARD.FAVOR ||
                c === CARD.REBOOT ||
                c === CARD.FATAL
              ) &&
              count < 2;
            const showInfo = needsPair || (canInspect && c === CARD.REBOOT);

            const isHighlighted =
              botHighlight?.type === "hand_card" && botHighlight.cardName === c;
            if (count === 1) {
              return (
                <Card
                  key={i}
                  name={c}
                  size="hand"
                  faceDown={hideHand || me?.isBot}
                  onClick={(event) => handleCardClick(c, event)}
                  disabled={!isPlayable}
                  onDisabledClick={
                    showInfo ? (event) => handleCardClick(c, event) : undefined
                  }
                  style={
                    isHighlighted
                      ? {
                          outline: "4px solid var(--accent)",
                          borderRadius: 12,
                          padding: 2,
                          display: "inline-block",
                        }
                      : undefined
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
                    faceDown={hideHand || me?.isBot}
                    onClick={(event) => handleCardClick(c, event)}
                    disabled={!isPlayable}
                    onDisabledClick={
                      showInfo
                        ? (event) => handleCardClick(c, event)
                        : undefined
                    }
                    style={{
                      "--stack-index": j,
                      ...(isHighlighted
                        ? {
                            outline: "4px solid var(--accent)",
                            borderRadius: 12,
                            padding: 2,
                            display: "inline-block",
                          }
                        : undefined),
                    }}
                  />
                ))}
              </div>
            );
          })}
          {isProMode && selectedCard && proModeOverlay && (
            <div
              ref={proModeOverlayRef}
              className="pro-mode-overlay"
              style={{
                top: `${proModeOverlay.top}px`,
                left: `${proModeOverlay.left}px`,
                width: `${proModeOverlay.width}px`,
                height: `${proModeOverlay.height}px`,
              }}
            >
              <div className="pro-mode-overlay__cover" />
              <div className="pro-mode-overlay__actions">
                {isActionCard && selectedCard !== CARD.REBOOT && (
                  <Button
                    type="button"
                    onClick={handlePlaySelected}
                    disabled={!canPlaySelected}
                    style={{ width: "100%" }}
                  >
                    Single
                  </Button>
                )}
                {selectedCard !== CARD.REBOOT &&
                  selectedCard !== CARD.FATAL && (
                    <>
                      <Button
                        type="button"
                        onClick={() => handleStartCombo("PAIR")}
                        disabled={!canPair}
                        style={{ width: "100%" }}
                      >
                        Pair
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleStartCombo("TRIPLE")}
                        disabled={!canTriple}
                        style={{ width: "100%" }}
                      >
                        Triple
                      </Button>
                    </>
                  )}
              </div>
            </div>
          )}
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
