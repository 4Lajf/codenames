<script lang="ts">
  import Card from './Card.svelte';
  import type { Card as CardType } from '../types';

  let { 
    cards = [], 
    canInteract = false,
    oncardclick 
  }: { 
    cards: (CardType & { showType?: boolean })[];
    canInteract: boolean;
    oncardclick?: (index: number) => void;
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
      onclick={() => oncardclick?.(index)}
    />
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.35rem;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  @media (min-width: 640px) {
    .board {
      gap: 0.5rem;
    }
  }
</style>
