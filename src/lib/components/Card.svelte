<script lang="ts">
  let { 
    word, 
    type, 
    revealed = false, 
    showType = false, 
    clickable = false,
    onclick
  }: { 
    word: string;
    type: 'red' | 'blue' | 'neutral' | 'assassin';
    revealed?: boolean;
    showType?: boolean;
    clickable?: boolean;
    onclick?: () => void;
  } = $props();

  let showLabel = $state(false);

  function handleClick() {
    if (revealed) {
      showLabel = !showLabel;
    } else if (clickable && onclick) {
      onclick();
    }
  }

  let typeClass = $derived((revealed || showType) ? type : 'unknown');
  let isRevealedClass = $derived(revealed ? 'revealed' : '');
</script>

<button 
  type="button"
  class="card-container"
  class:clickable={(clickable && !revealed) || revealed}
  onclick={handleClick}
  disabled={(!clickable && !revealed)}
  aria-label={`Card: ${word}`}
>
  <div class="card-inner {typeClass} {isRevealedClass}" class:spymaster-view={showType && !revealed}>
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
    background-color: #f3e5ab;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    transition: all 0.2s;
    border: 1px solid #d4c5a5;
  }

  .card-inner.spymaster-view.red { background-color: #ffcccc; box-shadow: inset 0 0 0 3px #c41e3a; }
  .card-inner.spymaster-view.blue { background-color: #cce0ff; box-shadow: inset 0 0 0 3px #1e5aa8; }
  .card-inner.spymaster-view.neutral { background-color: #f5f5f0; box-shadow: inset 0 0 0 3px #a09070; }
  .card-inner.spymaster-view.assassin { background-color: #333; box-shadow: inset 0 0 0 3px #000; }

  .card-inner.revealed {
      border: none;
  }
  .card-inner.revealed.red { background: linear-gradient(to bottom, #8b0000, #500000); }
  .card-inner.revealed.blue { background: linear-gradient(to bottom, #003366, #001a33); }
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
      flex: 1;
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
      height: 35%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      border-top: 1px solid rgba(0,0,0,0.1);
  }

  .word {
    color: #333;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 0.8rem;
    letter-spacing: 0.5px;
    text-align: center;
    padding: 0 4px;
    word-break: break-word;
  }

  @media (min-width: 640px) {
    .word { font-size: 0.9rem; }
  }
</style>
