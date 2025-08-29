import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CARD, createDeck, shuffle } from './cards';

describe('shuffle()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a new array with same elements', () => {
    const arr = [1, 2, 3, 4];
    const out = shuffle(arr);
    expect(out).not.toBe(arr);
    expect([...out].sort()).toEqual([...arr].sort());
  });

  it('is deterministic when Math.random is mocked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // With 0.5, expected permutation for [1,2,3,4] is [1,4,2,3]
    expect(shuffle([1, 2, 3, 4])).toEqual([1, 4, 2, 3]);
  });
});

describe('createDeck()', () => {
  it('builds correct hands and bombs for 2–5 players', () => {
    for (let players = 2; players <= 5; players++) {
      const { deck, hands } = createDeck(players);
      expect(hands.length).toBe(players);
      // Code deals 7 then adds 1 Reboot → 8 cards per hand
      hands.forEach((h) => {
        expect(h.length).toBe(8);
        expect(h).toContain(CARD.REBOOT);
        expect(h.filter((c) => c === CARD.FATAL).length).toBe(0);
      });
      const fatalInDeck = deck.filter((c) => c === CARD.FATAL).length;
      expect(fatalInDeck).toBe(Math.max(1, players - 1));
    }
  });
});

