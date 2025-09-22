// System Overload cards (no "Override")
import fatal from "../assets/cards/FatalServerError.webp";
import reboot from "../assets/cards/Reboot.webp";
import over from "../assets/cards/Override.webp";
import skip from "../assets/cards/SecurityPatch.webp";
import attack from "../assets/cards/DDoS.webp";
import shuffleImg from "../assets/cards/SudoRandom.webp";
import future from "../assets/cards/HealthCheck.webp";
import favor from "../assets/cards/Hack.webp";
import system from "../assets/cards/SystemOverload.webp";
import log from "../assets/cards/TamperedDataLog.webp";
import newCode from "../assets/cards/NewErrorCode.webp";
import valid from "../assets/cards/ValidCredentials.webp";
import rogue from "../assets/cards/RogueSoftware.webp";
import fuel from "../assets/cards/CoffeeFueledProgrammer.webp";

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
  [CARD.TAMPERED]: log,
  [CARD.NEW_ERROR]: newCode,
  [CARD.VALID_CREDS]: valid,
  [CARD.ROGUE_AV]: rogue,
  [CARD.COFFEE]: fuel,
};

// Preload all card images to avoid flicker when flipping to a face
const __preloaded = new Set();
export function preloadCardImages() {
  try {
    Object.values(CARD_IMG).forEach((src) => {
      if (!src || __preloaded.has(src)) return;
      const img = new Image();
      // Hint for earlier decode on some browsers
      try { img.decoding = 'async'; } catch {}
      try { img.loading = 'eager'; } catch {}
      img.src = src;
      __preloaded.add(src);
    });
  } catch {}
}

// Descriptive text for each card's effect
export const CARD_DESC = {
  [CARD.FATAL]: "If drawn without a Reboot, you are knocked out of the game",
  [CARD.REBOOT]:
    "Deactivate a Fatal Server Error when it is drawn and place it back in the deck",
  [CARD.SKIP]:
    "Play: End your turn immediately without drawing a card\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.ATTACK]:
    "Play: End your turn without drawing and force the next player to take two turns\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.SHUFFLE]:
    "Play: Shuffle the deck\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.FUTURE]:
    "Play: Look at the top three cards of the deck for 3 sec\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.FAVOR]:
    "Play: Request a random card from another player\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.TAMPERED]:
    "Single: Useless\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.NEW_ERROR]:
    "Single: Useless\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.VALID_CREDS]:
    "Single: Useless\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.ROGUE_AV]:
    "Single: Useless\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
  [CARD.COFFEE]:
    "Single: Useless\nPair: Choose a player to steal a random card from\nTriple: Choose a player & card, if they have it, you get it",
};
