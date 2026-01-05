<script lang="ts">
  import type { Player } from '../types';
  import * as Card from "$lib/components/ui/card";
  import { cn } from "$lib/utils";
  
  let { team, score, players = [], isActive = false }: { 
    team: 'red' | 'blue';
    score: number;
    players: Player[];
    isActive: boolean;
  } = $props();

  let spymaster = $derived(players.find(p => p.role === 'spymaster'));
  let operatives = $derived(players.filter(p => p.role === 'operative'));
</script>

<Card.Root class={cn(
  "min-w-[200px] border shadow-lg text-white overflow-hidden",
  team === 'red' ? "bg-gradient-to-br from-red-700 to-red-900 border-red-500" : "bg-gradient-to-br from-blue-700 to-blue-900 border-blue-500"
)}>
  <Card.Header class="flex flex-row justify-end items-center border-b border-white/20 pb-4">
    <div class="text-6xl font-extrabold leading-none drop-shadow-md">
      {score}
    </div>
  </Card.Header>
  
  <Card.Content class="pt-4 space-y-4">
    <div class="space-y-1">
      <div class="text-xs font-medium uppercase tracking-wider opacity-80">Operative(s)</div>
      <div class="flex flex-wrap gap-2 text-sm font-medium">
        {#each operatives as op}
          <span class="px-2 py-1 rounded border border-white/30 bg-white/10">{op.nickname}</span>
        {/each}
        {#if operatives.length === 0}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
    </div>

    <div class="space-y-1">
      <div class="text-xs font-medium uppercase tracking-wider opacity-80">Spymaster(s)</div>
      <div class="flex flex-wrap gap-2 text-sm font-medium">
        {#if spymaster}
          <span class="px-2 py-1 rounded border border-white/30 bg-white/10">{spymaster.nickname}</span>
        {:else}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
    </div>
  </Card.Content>
</Card.Root>
