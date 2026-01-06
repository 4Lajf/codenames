<script lang="ts">
  import type { Player } from '../types';
  import * as Card from "$lib/components/ui/card";
  import { cn } from "$lib/utils";
  
  let { 
    team, 
    score, 
    players = [], 
    isActive = false,
    showJoinButtons = false,
    currentPlayerTeam = null,
    currentPlayerRole = null,
    onjoinoperative,
    onjoinspymaster
  }: { 
    team: 'red' | 'blue';
    score: number;
    players: Player[];
    isActive: boolean;
    showJoinButtons?: boolean;
    currentPlayerTeam?: 'red' | 'blue' | null;
    currentPlayerRole?: 'operative' | 'spymaster' | null;
    onjoinoperative?: () => void;
    onjoinspymaster?: () => void;
  } = $props();

  let spymasters = $derived(players.filter(p => p.role === 'spymaster'));
  let operatives = $derived(players.filter(p => p.role === 'operative'));
  let isMyTeam = $derived(currentPlayerTeam === team);
  let isOperative = $derived(isMyTeam && currentPlayerRole === 'operative');
  let isSpymaster = $derived(isMyTeam && currentPlayerRole === 'spymaster');
  let isInAnyTeam = $derived(currentPlayerTeam !== null);
  let hasSpymaster = $derived(spymasters.length > 0);
</script>

<Card.Root class={cn(
  "min-w-[200px] border-2 shadow-xl text-white overflow-hidden",
  team === 'red' ? "bg-red-900/50 border-red-700/60" : "bg-blue-900/50 border-blue-600/60"
)}>
  <Card.Header class="flex flex-row justify-end items-center border-b border-white/20 pb-4">
    <div class="text-6xl font-extrabold leading-none text-white">
      {score}
    </div>
  </Card.Header>
  
  <Card.Content class="pt-4 space-y-4">
    <div class="space-y-1">
      <div class="text-xs font-medium uppercase tracking-wider opacity-70">Operative(s)</div>
      <div class="flex flex-wrap gap-2 text-sm font-medium">
        {#each operatives as op}
          <span class="px-2 py-1 rounded border border-white/30 bg-white/10 text-white">{op.nickname}</span>
        {/each}
        {#if operatives.length === 0}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
      {#if showJoinButtons && !isInAnyTeam && !isOperative && onjoinoperative}
        <button 
          class="mt-2 w-full text-xs px-2 py-1.5 rounded font-medium transition-colors {team === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'}"
          onclick={onjoinoperative}
        >
          {isMyTeam ? 'Switch to Operative' : 'Join as Operative'}
        </button>
      {/if}
    </div>

    <div class="space-y-1">
      <div class="text-xs font-medium uppercase tracking-wider opacity-70">Spymaster(s)</div>
      <div class="flex flex-wrap gap-2 text-sm font-medium">
        {#each spymasters as spy}
          <span class="px-2 py-1 rounded border border-white/30 bg-white/10 text-white">{spy.nickname}</span>
        {/each}
        {#if spymasters.length === 0}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
      {#if showJoinButtons && (!isInAnyTeam || !hasSpymaster) && !isSpymaster && onjoinspymaster}
        <button 
          class="mt-2 w-full text-xs px-2 py-1.5 rounded font-medium transition-colors {team === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'}"
          onclick={onjoinspymaster}
        >
          {isMyTeam ? 'Switch to Spymaster' : 'Join as Spymaster'}
        </button>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
