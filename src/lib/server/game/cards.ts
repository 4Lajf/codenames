import type { Card } from '../database.types';

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin';

/**
 * Generate card types for a game.
 * First team gets 9 cards, second team gets 8 cards.
 * Plus 7 neutral cards and 1 assassin.
 */
export function generateCardTypes(firstTeam: 'red' | 'blue'): CardType[] {
  const types: CardType[] = [
    ...Array(firstTeam === 'red' ? 9 : 8).fill('red'),
    ...Array(firstTeam === 'blue' ? 9 : 8).fill('blue'),
    ...Array(7).fill('neutral'),
    'assassin'
  ];
  
  return shuffle(types);
}

/**
 * Fisher-Yates shuffle algorithm
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Prepare cards data for a new game
 */
export function prepareGameCards(
  words: string[], 
  firstTeam: 'red' | 'blue'
): Array<{ word: string; position: number; type: CardType }> {
  if (words.length < 25) {
    throw new Error('Need at least 25 words to create a game');
  }

  const shuffledWords = shuffle(words).slice(0, 25);
  const cardTypes = generateCardTypes(firstTeam);

  return shuffledWords.map((word, index) => ({
    word: word.toUpperCase(),
    position: index,
    type: cardTypes[index]
  }));
}

/**
 * Mask card information for operatives (hide unrevealed card types)
 */
export function maskCardsForOperative(cards: Card[]): (Card & { type: CardType | 'hidden' })[] {
  return cards.map(card => ({
    ...card,
    type: card.revealed ? card.type : 'hidden' as const
  }));
}

/**
 * Calculate remaining cards for each team
 */
export function calculateRemainingCards(cards: Card[]): { red: number; blue: number } {
  let red = 0;
  let blue = 0;

  for (const card of cards) {
    if (!card.revealed) {
      if (card.type === 'red') red++;
      else if (card.type === 'blue') blue++;
    }
  }

  return { red, blue };
}

