<script lang="ts">
  import type { LogEntry } from '../types';
  import * as Card from "$lib/components/ui/card";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils";

  let { entries = [] }: { entries: LogEntry[] } = $props();
  
  let bottomRef: HTMLElement | undefined = $state();

  $effect(() => {
    // Re-run when entries change
    entries;
    if (bottomRef) {
      bottomRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Parse clue message: "Alice gave clue: ANIMAL 3" -> { player: "Alice", clue: "ANIMAL", count: "3" }
  function parseClue(message: string) {
    const match = message.match(/^(\w+) gave clue: (.+)$/);
    if (match) {
      const parts = match[2].split(' ');
      const count = parts.pop();
      const clue = parts.join(' ');
      return { player: match[1], clue, count };
    }
    return null;
  }

  // Parse guess message: "Bob guessed TIGER ✓" -> { player: "Bob", card: "TIGER", correct: true }
  function parseGuess(message: string) {
    const match = message.match(/^(\w+) guessed (\w+)/);
    if (match) {
      return { player: match[1], card: match[2], correct: message.includes('✓') };
    }
    return null;
  }
</script>

<Card.Root class="h-full flex flex-col shadow-md bg-white/95 backdrop-blur-sm border-0 overflow-hidden !py-0 !gap-0">
  <div class="py-1.5 px-3 border-b bg-gray-50/80 text-center">
    <span class="text-sm font-bold text-gray-700">Game log</span>
  </div>
  
  <div class="flex-1 min-h-0 relative pb-2">
    <ScrollArea class="h-full w-full">
      <div class="px-3 py-1 pb-3 space-y-1.5">
        {#each entries as entry}
          {#if entry.type === 'clue'}
            {@const parsed = parseClue(entry.message)}
            {#if parsed}
              <div class="text-sm leading-relaxed">
                <span class={cn("font-semibold", entry.team === 'red' ? "text-red-600" : "text-cyan-600")}>
                  {parsed.player}
                </span>
                <span class="text-gray-600 font-medium"> gives clue </span>
                <span class="font-bold text-gray-900">{parsed.clue} {parsed.count}</span>
              </div>
            {/if}
          {:else if entry.type === 'guess'}
            {@const parsed = parseGuess(entry.message)}
            {#if parsed}
              <div class="text-sm leading-relaxed">
                <span class={cn("font-semibold", entry.team === 'red' ? "text-red-600" : "text-cyan-600")}>
                  {parsed.player}
                </span>
                <span class="text-gray-600 font-medium"> taps </span>
                <span class={cn("font-bold", parsed.correct ? "text-green-600" : "text-gray-900")}>{parsed.card}</span>
              </div>
            {/if}
          {:else if entry.type === 'system' || entry.type === 'turn'}
            <div class="text-sm text-gray-500 italic font-medium">{entry.message}</div>
          {:else}
            <div class="text-sm text-gray-600 font-medium">{entry.message}</div>
          {/if}
        {/each}
        
        {#if entries.length === 0}
            <div class="text-center text-gray-400 italic text-sm">Waiting for first move...</div>
        {/if}
        <div bind:this={bottomRef}></div>
      </div>
    </ScrollArea>
  </div>
</Card.Root>
