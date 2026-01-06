<script lang="ts">
  import { Hand } from '@lucide/svelte';

  let { 
    word, 
    type, 
    revealed = false, 
    showType = false, 
    clickable = false,
    markers = [],
    myTeam = null,
    onclick,
    onmark
  }: { 
    word: string;
    type: 'red' | 'blue' | 'neutral' | 'assassin' | 'hidden';
    revealed?: boolean;
    showType?: boolean;
    clickable?: boolean;
    markers?: Array<{ nickname: string; team: 'red' | 'blue' | null }>;
    myTeam?: 'red' | 'blue' | null;
    onclick?: () => void;
    onmark?: () => void;
  } = $props();

  let showLabel = $state(false);

  function handleCardClick(e: MouseEvent) {
    // Don't do anything if clicking the guess handle
    if ((e.target as HTMLElement).closest('.guess-handle')) return;
    
    if (revealed) {
      showLabel = !showLabel;
    } else if (onmark) {
      // Place marker on unrevealed cards
      onmark();
    }
  }

  function handleGuess(e: MouseEvent) {
    e.stopPropagation();
    if (clickable && onclick && !revealed) {
      onclick();
    }
  }

  // Determine which type class to show - hidden maps to unknown styling
  let typeClass = $derived(() => {
    if (revealed || showType) {
      return type === 'hidden' ? 'unknown' : type;
    }
    return 'unknown';
  });
  let isRevealedClass = $derived(revealed ? 'revealed' : '');
</script>

<button 
  type="button"
  class="card-container"
  class:clickable={(clickable && !revealed) || revealed || !!onmark}
  onclick={handleCardClick}
  disabled={false}
  aria-label={`Card: ${word}`}
>
  <div class="card-inner {typeClass()} {isRevealedClass}" class:spymaster-view={showType && !revealed}>
      <!-- Guess handle for operatives -->
      {#if clickable && !revealed}
        <div 
          class="guess-handle"
          onclick={handleGuess}
          role="button"
          tabindex="0"
          aria-label="Guess this card"
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleGuess(e as any);
            }
          }}
        >
          <Hand size={16} />
        </div>
      {/if}

      <!-- Player markers -->
      {#if markers.length > 0 && !revealed}
        <div class="markers-container">
          {#each markers.slice(0, 3) as marker}
            <span 
              class="marker"
              class:marker-red={marker.team === 'red'}
              class:marker-blue={marker.team === 'blue'}
              class:marker-neutral={marker.team === null}
            >
              {marker.nickname.slice(0, 8)}
            </span>
          {/each}
          {#if markers.length > 3}
            <span class="marker marker-more">+{markers.length - 3}</span>
          {/if}
        </div>
      {/if}

      <div class="card-image-area">
          {#if revealed && type === 'assassin'}
              <div class="overlay-icon">☠️</div>
          {/if}
      </div>
      
      {#if !revealed || showLabel}
        <div class="card-label">
            <span class="word">{word}</span>
        </div>
      {/if}
  </div>
</button>

<style>
  .card-container {
    aspect-ratio: 5/3;
    width: 100%;
    cursor: default;
    perspective: 1000px;
    background: transparent;
    border: none;
    padding: 0;
    position: relative;
  }

  .clickable {
    cursor: pointer;
  }
  
  .clickable:hover .card-inner {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.3);
  }

  .card-inner {
    width: 100%;
    height: 100%;
    background-color: #e8dfa0;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    transition: all 0.2s;
    border: 1px solid #d4c5a5;
    opacity: 0.92;
  }

  .card-inner.spymaster-view.red { background-color: #ffcccc; box-shadow: inset 0 0 0 3px #c41e3a; }
  .card-inner.spymaster-view.blue { background-color: #cce0ff; box-shadow: inset 0 0 0 3px #1e5aa8; }
  .card-inner.spymaster-view.neutral { background-color: #f5f5f0; box-shadow: inset 0 0 0 3px #a09070; }
  .card-inner.spymaster-view.assassin { background-color: #333; box-shadow: inset 0 0 0 3px #000; }

  .card-inner.revealed {
      border: none;
  }
  .card-inner.revealed.red { background: #8b0000; }
  .card-inner.revealed.blue { background: #003366; }
  .card-inner.revealed.neutral { background: #888; }
  .card-inner.revealed.assassin { background: #111; }
  
  .card-inner.revealed .card-label {
      background: #ffffff;
      border-top: 1px solid rgba(0,0,0,0.1);
  }
  
  .card-inner.revealed .word {
      color: #333;
      text-shadow: none;
  }
  
  .card-inner.revealed .card-image-area {
      flex: 1;
      height: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
  }

  .card-image-area {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.03);
      position: relative;
  }

  .placeholder-art {
      width: 40px;
      height: 40px;
      opacity: 0.1;
      background: currentColor;
      border-radius: 50%;
  }
  
  .overlay-icon {
      font-size: 3rem;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  }

  .card-label {
      flex: 0 0 auto;
      min-height: 42%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      border-top: 1px solid rgba(0,0,0,0.1);
      padding: 0.35rem 0.5rem;
  }

  .word {
    color: #333;
    font-weight: 700;
    text-transform: uppercase;
    font-size: clamp(0.72rem, 1.6vw, 0.95rem);
    letter-spacing: 0.5px;
    text-align: center;
    line-height: 1.1;
    padding: 0;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-wrap: balance;
  }

  @media (min-width: 640px) {
    .card-label { padding: 0.4rem 0.6rem; }
  }

  /* Guess handle styling */
  .guess-handle {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 10;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid rgba(255, 255, 255, 0.8);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
    user-select: none;
  }

  .guess-handle:focus {
    outline: 2px solid rgba(255, 255, 255, 0.9);
    outline-offset: 2px;
  }

  .guess-handle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
    border-color: white;
  }

  .guess-handle:active {
    transform: scale(0.95);
  }

  /* Markers styling */
  .markers-container {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: calc(100% - 40px);
  }

  .marker {
    font-size: 9px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 3px;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 1px rgba(0,0,0,0.3);
    line-height: 1.2;
  }

  .marker-red {
    background: #dc2626;
  }

  .marker-blue {
    background: #2563eb;
  }

  .marker-neutral {
    background: #6b7280;
  }

  .marker-more {
    background: #374151;
    font-size: 8px;
  }
</style>
