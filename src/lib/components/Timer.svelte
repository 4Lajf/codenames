<script lang="ts">
  import { Clock, Pause, Play } from '@lucide/svelte';
  
  let {
    timeRemaining,
    isPaused,
    isActive,
    team,
    canPause = false,
    ontoggle
  }: {
    timeRemaining: number;
    isPaused: boolean;
    isActive: boolean;
    team: 'red' | 'blue';
    canPause?: boolean;
    ontoggle?: () => void;
  } = $props();

  function formatTime(seconds: number): string {
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  }

  let isWarning = $derived(timeRemaining <= 30 && timeRemaining > 0);
  let isDanger = $derived(timeRemaining <= 10 && timeRemaining > 0);
  let isOvertime = $derived(timeRemaining < 0);
</script>

<button
  class="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg transition-all font-mono text-sm lg:text-base font-bold
    {isActive ? 'opacity-100' : 'opacity-50'}
    {isDanger && isActive ? 'bg-red-500/30 text-red-200 animate-pulse' : 
     isWarning && isActive ? 'bg-yellow-500/30 text-yellow-200' :
     isOvertime ? 'bg-gray-500/30 text-gray-300' :
     team === 'red' ? 'bg-red-800/30 text-red-200' : 'bg-blue-800/30 text-blue-200'}
    {canPause ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}"
  onclick={() => {
    if (canPause && ontoggle) {
      ontoggle();
    }
  }}
  disabled={!canPause}
  title={canPause ? (isPaused ? 'Resume timer' : 'Pause timer') : 'Timer'}
>
  {#if isPaused}
    <Pause size={14} class="lg:w-4 lg:h-4" />
  {:else}
    <Clock size={14} class="lg:w-4 lg:h-4" />
  {/if}
  <span>{formatTime(timeRemaining)}</span>
</button>
