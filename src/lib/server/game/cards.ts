import type { Card } from '../database.types';

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin';

export type MaskedCard = Omit<Card, 'type'> & { type: CardType | 'hidden' };

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
 * Randomizes words, card types, and positions for a completely random board each game
 */
export function prepareGameCards(
  words: string[], 
  firstTeam: 'red' | 'blue'
): Array<{ word: string; position: number; type: CardType }> {
  if (words.length < 25) {
    throw new Error('Need at least 25 words to create a game');
  }

  // Randomly select 25 words from the available words
  const shuffledWords = shuffle(words).slice(0, 25);
  
  // Generate and shuffle card types
  const cardTypes = generateCardTypes(firstTeam);
  
  // Create array of positions (0-24) and shuffle them to randomize board layout
  const positions = Array.from({ length: 25 }, (_, i) => i);
  const shuffledPositions = shuffle(positions);

  // Map words to shuffled positions and types
  const cards = shuffledWords.map((word, index) => ({
    word: word.toUpperCase(),
    position: shuffledPositions[index],
    type: cardTypes[index]
  }));

  // Override: "SHIGATSU WA KIMI NO USO" is always assassin
  const specialCard = cards.find(c => c.word === 'SHIGATSU WA KIMI NO USO');
  if (specialCard) {
    // Find the current assassin card and swap its type with the special card
    const assassinCard = cards.find(c => c.type === 'assassin' && c.word !== 'SHIGATSU WA KIMI NO USO');
    if (assassinCard) {
      const originalType = specialCard.type;
      specialCard.type = 'assassin';
      assassinCard.type = originalType;
    } else {
      // If no other assassin found (shouldn't happen), just set it to assassin
      specialCard.type = 'assassin';
    }
  }

  // Sort by position to ensure cards are in correct order (0-24)
  return cards.sort((a, b) => a.position - b.position);
}

/**
 * Mask card information for operatives (hide unrevealed card types)
 */
export function maskCardsForOperative(cards: Card[]): MaskedCard[] {
  return cards.map(card => ({
    ...card,
    type: card.revealed ? card.type : ('hidden' as const)
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

