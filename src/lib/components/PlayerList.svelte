<script lang="ts">
  import type { Player } from '../types';

  let { players = [], currentPlayerId }: { players: Player[], currentPlayerId: string } = $props();

  function getRoleIcon(player: Player) {
    if (player.role === 'spymaster') return '🕵️';
    return '';
  }
</script>

<div class="player-list">
  {#each players as player}
    <div class="player">
      {#if getRoleIcon(player)}
        <span class="role">{getRoleIcon(player)}</span>
      {/if}
      <span class="name">
        {player.nickname}
      </span>
    </div>
  {:else}
    <div class="empty">No players yet</div>
  {/each}
</div>

<style>
  .player-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: white;
  }

  .player {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .empty {
    color: rgba(255,255,255,0.5);
    font-style: italic;
    font-size: 0.9rem;
  }
</style>
