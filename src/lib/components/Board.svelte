<script lang="ts">
  import Card from './Card.svelte';
  import type { Card as CardType } from '../types';

  let { 
    cards = [], 
    canInteract = false,
    markers = {},
    myTeam = null,
    spymasterSelectedCards = new Set<number>(),
    oncardclick,
    oncardmark
  }: { 
    cards: (CardType & { showType?: boolean })[];
    canInteract: boolean;
    markers?: Record<number, Array<{ nickname: string; team: 'red' | 'blue' | null }>>;
    myTeam?: 'red' | 'blue' | null;
    spymasterSelectedCards?: Set<number>;
    oncardclick?: (index: number) => void;
    oncardmark?: (index: number) => void;
  } = $props();
</script>

<div class="board">
  {#each cards as card, index}
    <Card 
      word={card.word}
      type={card.type}
      revealed={card.revealed}
      showType={card.showType || false}
      clickable={canInteract && !card.revealed}
      markers={markers[index] || []}
      {myTeam}
      spymasterSelected={spymasterSelectedCards.has(index)}
      onclick={() => oncardclick?.(index)}
      onmark={() => oncardmark?.(index)}
    />
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.25rem;
    width: 100%;
    max-width: 100%;
    margin: 0 auto;
    padding: 0;
  }

  @media (min-width: 400px) {
    .board {
      gap: 0.35rem;
    }
  }
  
  @media (min-width: 640px) {
    .board {
      gap: 0.45rem;
      max-width: 720px;
    }
  }
  
  @media (min-width: 900px) {
    .board {
      gap: 0.55rem;
      max-width: 800px;
    }
  }
  
  @media (min-width: 1200px) {
    .board {
      max-width: 920px;
    }
  }
</style>
