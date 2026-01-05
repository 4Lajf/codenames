import type { GameState, Player, Card } from '../types';

// Functions that simulate server responses
// Used to test UI state changes

export function mockRevealCard(cardIndex: number, gameState: GameState): GameState {
  // Clone state
  const newState = JSON.parse(JSON.stringify(gameState));
  const card = newState.cards[cardIndex];

  if (card.revealed) return newState;

  card.revealed = true;
  
  // Logic for turn handling
  const isCorrect = card.type === newState.currentTurn;
  const isAssassin = card.type === 'assassin';
  const isNeutral = card.type === 'neutral';
  const isOpponent = card.type === (newState.currentTurn === 'red' ? 'blue' : 'red');

  // Add log entry
  newState.log.push({
    type: 'guess',
    team: newState.currentTurn,
    message: `${newState.currentTurn} revealed ${card.word} (${card.type})`,
    timestamp: Date.now()
  });

  if (isAssassin) {
    newState.status = 'finished';
    newState.winner = newState.currentTurn === 'red' ? 'blue' : 'red';
    newState.log.push({ type: 'system', message: 'Assassin hit! Game over.', timestamp: Date.now() });
    return newState;
  }

  if (isNeutral || isOpponent) {
    // End turn
    newState.currentTurn = newState.currentTurn === 'red' ? 'blue' : 'red';
    newState.clue = null;
    newState.guessesRemaining = 0;
    newState.log.push({ type: 'turn', message: `${newState.currentTurn} team's turn`, timestamp: Date.now() });
  } else if (isCorrect) {
    // Decrement guesses
    if (newState.guessesRemaining > 0) {
      newState.guessesRemaining--;
    }
    
    // Check win condition
    const redLeft = newState.cards.filter((c: Card) => c.type === 'red' && !c.revealed).length;
    const blueLeft = newState.cards.filter((c: Card) => c.type === 'blue' && !c.revealed).length;
    
    newState.scores = { red: 9 - redLeft, blue: 8 - blueLeft }; // Assuming 9/8 start

    if (redLeft === 0) {
      newState.status = 'finished';
      newState.winner = 'red';
    } else if (blueLeft === 0) {
      newState.status = 'finished';
      newState.winner = 'blue';
    }
  }

  return newState;
}

export function mockGiveClue(word: string, count: number, gameState: GameState): GameState {
  const newState = JSON.parse(JSON.stringify(gameState));
  
  newState.clue = { word, count };
  newState.guessesRemaining = count + 1; // +1 bonus guess
  
  newState.log.push({
    type: 'clue',
    team: newState.currentTurn,
    message: `${newState.currentTurn} Spymaster gives clue: ${word} ${count}`,
    timestamp: Date.now()
  });

  return newState;
}

export function mockEndTurn(gameState: GameState): GameState {
  const newState = JSON.parse(JSON.stringify(gameState));
  
  newState.currentTurn = newState.currentTurn === 'red' ? 'blue' : 'red';
  newState.clue = null;
  newState.guessesRemaining = 0;
  
  newState.log.push({
    type: 'turn',
    message: `${newState.currentTurn} team's turn`,
    timestamp: Date.now()
  });

  return newState;
}

export function mockJoinTeam(playerId: string, team: 'red' | 'blue', role: 'operative' | 'spymaster', players: Player[]): Player[] {
  const newPlayers = JSON.parse(JSON.stringify(players));
  const playerIndex = newPlayers.findIndex((p: Player) => p.id === playerId);
  
  if (playerIndex !== -1) {
    // Check if role is taken (spymaster limit 1)
    if (role === 'spymaster') {
      const existingSpymaster = newPlayers.find((p: Player) => p.team === team && p.role === 'spymaster');
      if (existingSpymaster) return players; // Role taken
    }
    
    newPlayers[playerIndex].team = team;
    newPlayers[playerIndex].role = role;
  }
  
  return newPlayers;
}

