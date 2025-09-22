import { CARD, COMBO_CARDS } from "../game/cards";

// Upgraded heuristic bot with support for all actions and combos.
// Returns action objects consumed by the game loop.

function countIn(hand, card) {
  return hand.reduce((n, c) => n + (c === card ? 1 : 0), 0);
}

function aliveOpponents(game) {
  const me = game.turn;
  return game.players
    .filter((p) => p.alive && p.id !== me)
    .map((p) => p.id);
}

function pickMaxBy(ids, scoreFn) {
  if (ids.length === 0) return null;
  let best = ids[0];
  let bestScore = scoreFn(best);
  for (let i = 1; i < ids.length; i++) {
    const id = ids[i];
    const s = scoreFn(id);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

export function chooseFavorTarget(game) {
  const opps = aliveOpponents(game);
  return (
    pickMaxBy(opps, (id) => game.hands[id]?.length || 0) ?? opps[0] ?? null
  );
}

export function choosePairTarget(game) {
  return chooseFavorTarget(game);
}

export function choosePairIndex(game) {
  const toId = game.comboTarget;
  const opp = (toId != null && game.hands[toId]) || [];
  if (opp.length === 0) return 0;
  return Math.floor(Math.random() * opp.length);
}

export function chooseTripleTarget(game) {
  return chooseFavorTarget(game);
}

export function chooseTripleCard(game) {
  const hand = game.hands[game.turn] || [];
  const priorities = [
    CARD.REBOOT,
    CARD.ATTACK,
    CARD.SKIP,
    CARD.FUTURE,
    CARD.FAVOR,
  ];
  for (const c of priorities) {
    if (!hand.includes(c)) return c;
  }
  // Otherwise ask for a random combo card to deny sets
  const combos = [...COMBO_CARDS];
  return combos[Math.floor(Math.random() * combos.length)];
}

export function chooseAction(game) {
  const me = game.turn;
  const hand = game.hands[me] || [];
  const deckSize = game.deck.length;
  const turnsToTake = game.turnsToTake || 1;

  const has = (c) => hand.includes(c);
  const cnt = (c) => countIn(hand, c);

  const hasPeekFatal = (game.peek || []).includes(CARD.FATAL);

  // 1) Immediate danger mitigation when a Fatal is imminent
  if (hasPeekFatal) {
    if (has(CARD.SHUFFLE)) return { type: "PLAY_SHUFFLE" };
    if (has(CARD.SKIP)) return { type: "PLAY_SKIP" };
    if (has(CARD.ATTACK)) return { type: "PLAY_ATTACK" };
    // Otherwise hope to draw Reboot
    return { type: "DRAW" };
  }

  // 2) Under multiple forced turns: try to bail out/deflect
  if (turnsToTake > 1) {
    if (has(CARD.SKIP)) return { type: "PLAY_SKIP" };
    if (has(CARD.ATTACK)) return { type: "PLAY_ATTACK" };
  }

  // 3) Strong triple: name a valuable card we don't have
  for (const combo of COMBO_CARDS) {
    if (cnt(combo) >= 3) {
      return { type: "PLAY_TRIPLE", cardName: combo };
    }
  }

  // 4) Use Favor when others have cards and our hand is light
  const opps = aliveOpponents(game);
  const oppHasCards = opps.some((id) => (game.hands[id] || []).length > 0);
  if (has(CARD.FAVOR) && oppHasCards && hand.length <= 5) {
    return { type: "PLAY_FAVOR" };
  }

  // 5) Use pair to steal randomly if available
  for (const combo of COMBO_CARDS) {
    if (cnt(combo) >= 2) {
      return { type: "PLAY_PAIR", cardName: combo };
    }
  }

  // 6) If we lack a Reboot, seek info or reduce risk
  if (!has(CARD.REBOOT)) {
    if (has(CARD.FUTURE)) return { type: "PLAY_FUTURE" };
    if (deckSize <= 3 && has(CARD.SHUFFLE)) return { type: "PLAY_SHUFFLE" };
  }

  // 7) Opportunistic attack with moderate probability
  if (has(CARD.ATTACK) && Math.random() < 0.25) {
    return { type: "PLAY_ATTACK" };
  }

  // 8) Skip occasionally to avoid drawing when hand is strong
  if (has(CARD.SKIP) && hand.length >= 7 && Math.random() < 0.35) {
    return { type: "PLAY_SKIP" };
  }

  // 9) Default: draw a card
  return { type: "DRAW" };
}
