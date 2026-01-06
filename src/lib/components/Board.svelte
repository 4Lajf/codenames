<script lang="ts">
  import Card from './Card.svelte';
  import type { Card as CardType } from '../types';

  let { 
    cards = [], 
    canInteract = false,
    markers = {},
    myTeam = null,
    oncardclick,
    oncardmark
  }: { 
    cards: (CardType & { showType?: boolean })[];
    canInteract: boolean;
    markers?: Record<number, Array<{ nickname: string; team: 'red' | 'blue' | null }>>;
    myTeam?: 'red' | 'blue' | null;
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
      onclick={() => oncardclick?.(index)}
      onmark={() => oncardmark?.(index)}
    />
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.4rem;
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
  }

  @media (min-width: 640px) {
    .board {
      gap: 0.55rem;
    }
  }
</style>
