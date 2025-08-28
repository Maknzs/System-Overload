// System Overload cards (no "Override")
import fatal from "../assets/cards/FatalServerError.png";
import reboot from "../assets/cards/Reboot.png";
import skip from "../assets/cards/SecurityPatch.png";
import attack from "../assets/cards/DDoS.png";
import shuffleImg from "../assets/cards/SudoRandom.png";
import future from "../assets/cards/HealthCheck.png";
import favor from "../assets/cards/Hack.png";
import system from "../assets/cards/SystemOverload.png";
import log from "../assets/cards/TamperedDataLog.png";
import newCode from "../assets/cards/NewErrorCode.png";
import valid from "../assets/cards/ValidCredentials.png";
import rogue from "../assets/cards/RogueSoftware.png";
import fuel from "../assets/cards/CoffeeFueledProgrammer.png";

export const STOCK_CARD_IMG = system;

export const CARD = {
  FATAL: "Fatal Server Error",
  REBOOT: "Reboot",
  SKIP: "Security Patch",
  ATTACK: "DDoS Event",
  SHUFFLE: "Sudo Random",
  FUTURE: "Health Check",
  FAVOR: "Hack",
  TAMPERED: "Tampered Data Log",
  NEW_ERROR: "New Error Code",
  VALID_CREDS: "Valid Credentials?",
  ROGUE_AV: "Rogue Anti-virus Software",
  COFFEE: "Coffee Fueled Programmer",
};

export const COMBO_CARDS = [
  CARD.TAMPERED,
  CARD.NEW_ERROR,
  CARD.VALID_CREDS,
  CARD.ROGUE_AV,
  CARD.COFFEE,
];

export function createDeck(playerCount) {
  // Minimal counts tuned for 2–5 players
  const base = [
    ...Array(playerCount === 5 ? 1 : 2).fill(CARD.REBOOT),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.SKIP),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.ATTACK),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.SHUFFLE),
    ...Array(playerCount < 4 ? 4 : 5).fill(CARD.FUTURE),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.FAVOR),
    // Pair/triple-only combos
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.TAMPERED),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.NEW_ERROR),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.VALID_CREDS),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.ROGUE_AV),
    ...Array(playerCount < 4 ? 3 : 4).fill(CARD.COFFEE),
  ];
  // Shuffle base
  const deck = shuffle(base);

  // Deal 4 cards to each player
  const hands = Array.from({ length: playerCount }, () => []);
  for (let r = 0; r < 7; r++) {
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
  [CARD.TAMPERED]: log,
  [CARD.NEW_ERROR]: newCode,
  [CARD.VALID_CREDS]: valid,
  [CARD.ROGUE_AV]: rogue,
  [CARD.COFFEE]: fuel,
};
