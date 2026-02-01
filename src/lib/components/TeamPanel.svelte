<script lang="ts">
  import type { Player } from '../types';
  import * as Card from "$lib/components/ui/card";
  import { cn } from "$lib/utils";
  import Timer from './Timer.svelte';
  
  let { 
    team, 
    score, 
    players = [], 
    isActive = false,
    showJoinButtons = false,
    currentPlayerTeam = null,
    currentPlayerRole = null,
    timeRemaining = 0,
    isPaused = false,
    canPauseTimer = false,
    onjoinoperative,
    onjoinspymaster,
    ontimerToggle
  }: { 
    team: 'red' | 'blue';
    score: number;
    players: Player[];
    isActive: boolean;
    showJoinButtons?: boolean;
    currentPlayerTeam?: 'red' | 'blue' | null;
    currentPlayerRole?: 'operative' | 'spymaster' | null;
    timeRemaining?: number;
    isPaused?: boolean;
    canPauseTimer?: boolean;
    onjoinoperative?: () => void;
    onjoinspymaster?: () => void;
    ontimerToggle?: () => void;
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
  "min-w-0 w-full border-2 shadow-xl text-white overflow-hidden",
  team === 'red' ? "bg-red-900/50 border-red-700/60" : "bg-blue-900/50 border-blue-600/60"
)}>
  <Card.Header class="flex flex-row justify-between items-center border-b border-white/20 py-2 lg:py-3 px-3 lg:px-4">
    <Timer 
      {timeRemaining}
      {isPaused}
      isActive={isActive}
      {team}
      canPause={canPauseTimer}
      ontoggle={ontimerToggle}
    />
    <div class="text-4xl lg:text-5xl xl:text-6xl font-extrabold leading-none text-white">
      {score}
    </div>
  </Card.Header>
  
  <Card.Content class="pt-2 lg:pt-3 pb-3 px-3 lg:px-4 space-y-2 lg:space-y-3">
    <div class="space-y-1">
      <div class="text-[10px] lg:text-xs font-medium uppercase tracking-wider opacity-70">Operative(s)</div>
      <div class="flex flex-wrap gap-1.5 lg:gap-2 text-xs lg:text-sm font-medium">
        {#each operatives as op (`op-${op.id}-${op.nickname}`)}
          <span class="px-1.5 lg:px-2 py-0.5 lg:py-1 rounded border border-white/30 bg-white/10 text-white truncate max-w-[100px] lg:max-w-none">{op.nickname}</span>
        {/each}
        {#if operatives.length === 0}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
      {#if showJoinButtons && !isInAnyTeam && !isOperative && onjoinoperative}
        <button 
          class="mt-1.5 lg:mt-2 w-full text-[10px] lg:text-xs px-2 py-1 lg:py-1.5 rounded font-medium transition-colors {team === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'}"
          onclick={onjoinoperative}
        >
          {isMyTeam ? 'Switch to Operative' : 'Join as Operative'}
        </button>
      {/if}
    </div>

    <div class="space-y-1">
      <div class="text-[10px] lg:text-xs font-medium uppercase tracking-wider opacity-70">Spymaster(s)</div>
      <div class="flex flex-wrap gap-1.5 lg:gap-2 text-xs lg:text-sm font-medium">
        {#each spymasters as spy (`spy-${spy.id}-${spy.nickname}`)}
          <span class="px-1.5 lg:px-2 py-0.5 lg:py-1 rounded border border-white/30 bg-white/10 text-white truncate max-w-[100px] lg:max-w-none">{spy.nickname}</span>
        {/each}
        {#if spymasters.length === 0}
          <span class="italic opacity-50">-</span>
        {/if}
      </div>
      {#if showJoinButtons && (!isInAnyTeam || !hasSpymaster) && !isSpymaster && onjoinspymaster}
        <button 
          class="mt-1.5 lg:mt-2 w-full text-[10px] lg:text-xs px-2 py-1 lg:py-1.5 rounded font-medium transition-colors {team === 'red' ? 'bg-red-700 hover:bg-red-600' : 'bg-blue-700 hover:bg-blue-600'}"
          onclick={onjoinspymaster}
        >
          {isMyTeam ? 'Switch to Spymaster' : 'Join as Spymaster'}
        </button>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
