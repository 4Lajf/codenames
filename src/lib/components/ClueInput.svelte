<script lang="ts">
  import { Input } from "$lib/components/ui/input";

  let { disabled = false, onsubmit }: { disabled?: boolean; onsubmit?: (data: {word: string, count: number}) => void } = $props();

  let word = $state('');
  let count = $state(1);
  let showCountMenu = $state(false);

  const countOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

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

<form onsubmit={handleSubmit} class="flex items-center gap-2 bg-white/95 p-2 rounded-xl shadow-xl border border-gray-200 backdrop-blur-sm">
  <div class="flex-1">
      <Input 
        type="text" 
        bind:value={word} 
        placeholder="Clue" 
        {disabled}
        required
        pattern="[A-Za-z]+"
        class="min-w-[150px] bg-white"
      />
  </div>
  <div class="relative">
      <button
        type="button"
        class="w-[50px] h-9 text-center bg-white border border-gray-300 rounded-md font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onclick={() => showCountMenu = !showCountMenu}
        {disabled}
      >
        {displayCount(count)}
      </button>
      {#if showCountMenu}
        <div class="absolute bottom-full left-0 mb-1 flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50">
          {#each countOptions as n}
            <button
              type="button"
              class="w-8 h-8 rounded hover:bg-gray-100 font-medium text-sm {count === n ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
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
    class="px-4 h-9 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Give
  </button>
</form>
