<script lang="ts">
  import { Input } from "$lib/components/ui/input";

  let { disabled = false, selectedCount = 0, onsubmit }: { disabled?: boolean; selectedCount?: number; onsubmit?: (data: {word: string, count: number}) => void } = $props();

  let word = $state('');
  let count = $state(1);
  let showCountMenu = $state(false);

  const countOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  // Sync count with selectedCount when it changes
  $effect(() => {
    if (selectedCount > 0) {
      count = selectedCount;
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (word.trim() && onsubmit) {
      onsubmit({ word: word.trim(), count: Number(count) });
      word = '';
      count = 1;
    }
  }

  function selectCount(n: number) {
    count = n;
    showCountMenu = false;
  }

  function displayCount(n: number): string {
    return n === 0 ? '∞' : String(n);
  }
</script>

<form onsubmit={handleSubmit} class="flex items-center gap-1.5 sm:gap-2 bg-white/95 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-xl border border-gray-200 backdrop-blur-sm max-w-[95vw]">
  <div class="flex-1 min-w-0">
      <Input 
        type="text" 
        bind:value={word} 
        placeholder="Clue" 
        {disabled}
        required
        class="min-w-[80px] sm:min-w-[120px] md:min-w-[150px] bg-white text-sm sm:text-base"
      />
  </div>
  <div class="relative shrink-0">
      <button
        type="button"
        class="w-10 sm:w-[50px] h-8 sm:h-9 text-center bg-white border border-gray-300 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
        onclick={() => showCountMenu = !showCountMenu}
        {disabled}
      >
        {displayCount(count)}
      </button>
      {#if showCountMenu}
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-wrap gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50 max-w-[200px] justify-center">
          {#each countOptions as n}
            <button
              type="button"
              class="w-7 h-7 sm:w-8 sm:h-8 rounded hover:bg-gray-100 font-medium text-xs sm:text-sm {count === n ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
              onclick={() => selectCount(n)}
            >
              {displayCount(n)}
            </button>
          {/each}
        </div>
      {/if}
  </div>
  <button 
    type="submit" 
    disabled={disabled || !word.trim()} 
    class="px-2.5 sm:px-4 h-8 sm:h-9 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base shrink-0"
  >
    Give
  </button>
</form>
