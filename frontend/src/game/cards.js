// System Overload cards (no "Override")
import fatal from "../assets/cards/FatalServerError.png";
import reboot from "../assets/cards/Reboot.png";
import skip from "../assets/cards/SecurityPatch.png";
import attack from "../assets/cards/DDoS.png";
import shuffleImg from "../assets/cards/SudoRandom.png";
import future from "../assets/cards/HealthCheck.png";
import favor from "../assets/cards/Hack.png";
import system from "../assets/cards/SystemOverload.png";

export const STOCK_CARD_IMG = system;

export const CARD = {
  FATAL: "Fatal Server Error",
  REBOOT: "Reboot",
  SKIP: "Security Patch",
  ATTACK: "DDoS Event",
  SHUFFLE: "Sudo Random",
  FUTURE: "Health Check",
  FAVOR: "Hack",
};

export function createDeck(playerCount) {
  // Minimal counts tuned for 2–5 players
  const base = [
    ...Array(4).fill(CARD.REBOOT),
    ...Array(4).fill(CARD.SKIP),
    ...Array(4).fill(CARD.ATTACK),
    ...Array(4).fill(CARD.SHUFFLE),
    ...Array(5).fill(CARD.FUTURE),
    ...Array(4).fill(CARD.FAVOR),
  ];
  // Shuffle base
  const deck = shuffle(base);

  // Deal 4 cards to each player
  const hands = Array.from({ length: playerCount }, () => []);
  for (let r = 0; r < 4; r++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck.pop());
    }
  }
  // Give each player one Reboot (defuse)
  for (let p = 0; p < playerCount; p++) {
    hands[p].push(CARD.REBOOT);
  }
  // Add Fatal bombs = playerCount - 1
  const bombs = Array.from(
    { length: Math.max(1, playerCount - 1) },
    () => CARD.FATAL
  );
  deck.push(...bombs);
  // Final shuffle before play
  return { deck: shuffle(deck), hands };
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const CARD_IMG = {
  [CARD.FATAL]: fatal,
  [CARD.REBOOT]: reboot,
  [CARD.SKIP]: skip,
  [CARD.ATTACK]: attack,
  [CARD.SHUFFLE]: shuffleImg,
  [CARD.FUTURE]: future,
  [CARD.FAVOR]: favor,
};
