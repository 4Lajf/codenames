<script lang="ts">
  import type { LogEntry } from '../types';
  import * as Card from "$lib/components/ui/card";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils";

  let { entries = [] }: { entries: LogEntry[] } = $props();
  
  let bottomRef: HTMLElement | undefined = $state();

  $effect(() => {
    entries;
    if (bottomRef) {
      bottomRef.scrollIntoView({ behavior: 'smooth' });
    }
  });

  function parseClue(message: string) {
    const match = message.match(/^(.+) gives clue: (.+)$/);
    if (match) {
      const parts = match[2].split(' ');
      const count = parts.pop();
      const clue = parts.join(' ');
      return { player: match[1], clue, count };
    }
    const legacyMatch = message.match(/^(\w+) gave clue: (.+)$/);
    if (legacyMatch) {
      const parts = legacyMatch[2].split(' ');
      const count = parts.pop();
      const clue = parts.join(' ');
      return { player: legacyMatch[1], clue, count };
    }
    return null;
  }

  function parseGuess(message: string) {
    const match = message.match(/^(.+) revealed (.+) \((\w+)\)$/);
    if (match) {
      return { player: match[1], card: match[2], cardType: match[3] };
    }
    return null;
  }

  function getCardTypeColor(cardType: string): string {
    switch (cardType.toLowerCase()) {
      case 'red': return 'bg-red-600 text-white';
      case 'blue': return 'bg-blue-600 text-white';
      case 'neutral': return 'bg-amber-200 text-amber-900';
      case 'assassin': return 'bg-black text-white';
      default: return 'bg-gray-300 text-gray-800';
    }
  }

  function parseTurnMessage(message: string) {
    // Handle both formats: "red team's turn" and "Player ended the turn. red team's turn"
    const teamMatch = message.match(/(red|blue) team's turn/i);
    if (teamMatch) {
      const team = teamMatch[1].toLowerCase() as 'red' | 'blue';
      const endedByMatch = message.match(/^(.+) ended the turn\./);
      return {
        team,
        endedBy: endedByMatch ? endedByMatch[1] : null
      };
    }
    return null;
  }
</script>

<Card.Root class="h-full flex flex-col shadow-xl bg-gray-900/50 backdrop-blur-sm border-2 border-gray-700/50 overflow-hidden py-0! gap-0!">
  <div class="py-1.5 px-3 border-b border-white/20 bg-gray-800/50 text-center">
    <span class="text-sm font-bold text-white/90">Game log</span>
  </div>
  
  <div class="flex-1 min-h-0 relative pb-2">
    <ScrollArea class="h-full w-full">
      <div class="px-3 py-1 pb-3 space-y-1.5">
        {#each entries as entry}
          {#if entry.type === 'clue'}
            {#if parseClue(entry.message)}
              <div class="text-sm leading-relaxed p-1.5 rounded-md my-0.5 {entry.team === 'red' ? 'bg-red-900/30' : 'bg-blue-900/30'}">
                <span class={cn("font-semibold", entry.team === 'red' ? "text-red-400" : "text-blue-400")}>
                  {parseClue(entry.message)?.player}
                </span>
                <span class="text-white/70 font-medium"> gives clue </span>
                <span class="font-bold text-white uppercase">{parseClue(entry.message)?.clue} {parseClue(entry.message)?.count}</span>
              </div>
            {/if}
          {:else if entry.type === 'guess'}
            {#if parseGuess(entry.message)}
              {@const guess = parseGuess(entry.message)}
              <div class="text-sm leading-relaxed p-1.5 rounded-md my-0.5 {entry.team === 'red' ? 'bg-red-900/30' : 'bg-blue-900/30'}">
                <span class={cn("font-semibold", entry.team === 'red' ? "text-red-400" : "text-blue-400")}>
                  {guess?.player}
                </span>
                <span class="text-white/70 font-medium"> taps </span>
                <span class="inline-block px-1.5 py-0.5 rounded text-xs font-bold uppercase {getCardTypeColor(guess?.cardType || '')}">
                  {guess?.card}
                </span>
              </div>
            {/if}
          {:else if entry.type === 'turn'}
            {@const turnInfo = parseTurnMessage(entry.message)}
            {#if turnInfo}
              <div class="text-sm text-white/60 italic font-medium py-1">
                {#if turnInfo.endedBy}
                  <span class="text-white/70">{turnInfo.endedBy}</span> ended the turn. 
                {/if}
                <span class={turnInfo.team === 'red' ? 'text-red-400' : 'text-blue-400'}>
                  {turnInfo.team === 'red' ? 'Red' : 'Blue'} team's turn
                </span>
              </div>
            {:else}
              <div class="text-sm text-white/50 italic font-medium">{entry.message}</div>
            {/if}
          {:else if entry.type === 'system'}
            <div class="text-sm text-white/50 italic font-medium">{entry.message}</div>
          {/if}
        {/each}
        
        {#if entries.length === 0}
          <div class="text-center text-white/40 italic text-sm">Waiting for first move...</div>
        {/if}
        <div bind:this={bottomRef}></div>
      </div>
    </ScrollArea>
  </div>
</Card.Root>
