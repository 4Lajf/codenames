<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  import Board from '$lib/components/Board.svelte';
  import TeamPanel from '$lib/components/TeamPanel.svelte';
  import GameLog from '$lib/components/GameLog.svelte';
  import StatusBanner from '$lib/components/StatusBanner.svelte';
  import ClueInput from '$lib/components/ClueInput.svelte';
  import PlayerList from '$lib/components/PlayerList.svelte';
  import NicknameDialog from '$lib/components/NicknameDialog.svelte';
  
  import * as Card from "$lib/components/ui/card";

  import { game, isMyTurn, canGuess, canGiveClue, visibleCards } from '$lib/stores/game';
  import { player } from '$lib/stores/player';
  import { room } from '$lib/stores/room';

  let roomCode = $page.params.code;
  let showNickname = $state(false);
  let showPlayers = $state(false);

  onMount(() => {
    room.setRoomCode(roomCode);
    // Check if nickname already exists in store or localStorage
    const savedName = localStorage.getItem('codenames_nickname');
    if (savedName) {
      player.updateNickname(savedName);
      showNickname = false;
    } else if (!$player.nickname || $player.nickname === 'You') {
      // Only show dialog if no nickname is set or it's still the default
      showNickname = true;
    } else {
      showNickname = false;
    }
  });

  // Derived state for UI
  let statusMessage = $derived(getStatusMessage($game));
  let redPlayers = $derived($room.players.filter(p => p.team === 'red'));
  let bluePlayers = $derived($room.players.filter(p => p.team === 'blue'));
  let redScore = $derived($game.scores.red);
  let blueScore = $derived($game.scores.blue);

  function getStatusMessage(state: any) {
    if (state.status === 'finished') {
      return state.winner === 'red' ? 'Red Team Wins!' : 'Blue Team Wins!';
    }
    if (state.status === 'playing') {
      const turnMsg = state.currentTurn === 'red' ? 'Red Team is playing' : 'Blue Team is playing';
      if (state.clue) return `${turnMsg}, guess! (${state.guessesRemaining} left)`;
      return `${turnMsg}, wait for your turn...`;
    }
    return 'Waiting for game to start...';
  }

  function handleCardClick(index: number) {
    if ($canGuess) {
      game.revealCard(index);
    }
  }

  function handleClueSubmit(data: {word: string, count: number}) {
    if ($canGiveClue) {
      game.giveClue(data.word, data.count);
    }
  }

  function handleJoinTeam(team: 'red' | 'blue') {
    player.joinTeam(team, 'operative');
  }

  function handleBecomeSpymaster(team: 'red' | 'blue') {
    player.joinTeam(team, 'spymaster');
  }
  
  function handleNicknameSubmit(name: string) {
    player.updateNickname(name);
    showNickname = false;
  }
</script>

<div class="h-screen flex flex-col overflow-hidden bg-codenames-orange">
  <!-- Top Header Bar -->
  <header class="h-[40px] flex justify-between items-center px-4 z-10">
      <div class="flex items-center">
          <button 
            class="bg-yellow-400 text-black hover:bg-yellow-500 rounded-full font-bold shadow-md px-4 py-1.5 text-sm"
            onclick={() => showPlayers = true}
          >
            Players 👤 {$room.players.length}
          </button>
      </div>
      <div class="flex items-center gap-2">
          <div class="bg-orange-500 text-white rounded-full px-4 py-1.5 text-sm font-bold shadow-md">
            {$player.nickname} 👤
          </div>
      </div>
  </header>

  {#if $room.status === 'waiting'}
    <div class="p-8 text-center text-white overflow-auto flex-1 flex flex-col items-center">
      <h1 class="text-4xl font-bold mb-8 drop-shadow-md">Room {roomCode}</h1>
      
      <div class="flex flex-wrap justify-center gap-8 mb-8 w-full max-w-4xl">
        <!-- Red Team Lobby -->
        <Card.Root class="w-[300px] bg-red-950/80 border-0 text-white overflow-hidden">
          <Card.Header class="bg-red-800 py-3">
             <Card.Title class="text-white text-center">Red Team</Card.Title>
          </Card.Header>
          <Card.Content class="p-4 space-y-3">
             <button class="w-full bg-red-800/80 text-white hover:bg-red-700 px-4 py-2 rounded-md transition-colors font-medium" onclick={() => handleJoinTeam('red')}>
               Join as Operative
             </button>
             <button class="w-full bg-red-800/80 text-white hover:bg-red-700 px-4 py-2 rounded-md transition-colors font-medium" onclick={() => handleBecomeSpymaster('red')}>
               Become Spymaster
             </button>
             <div class="mt-4 pt-4 border-t border-white/10">
               <PlayerList players={redPlayers} currentPlayerId={$player.id} />
             </div>
          </Card.Content>
        </Card.Root>

        <!-- Blue Team Lobby -->
        <Card.Root class="w-[300px] bg-red-950/80 border-0 text-white overflow-hidden">
          <Card.Header class="bg-blue-800 py-3">
             <Card.Title class="text-white text-center">Blue Team</Card.Title>
          </Card.Header>
          <Card.Content class="p-4 space-y-3">
             <button class="w-full bg-blue-800/80 text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors font-medium" onclick={() => handleJoinTeam('blue')}>
               Join as Operative
             </button>
             <button class="w-full bg-blue-800/80 text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors font-medium" onclick={() => handleBecomeSpymaster('blue')}>
               Become Spymaster
             </button>
             <div class="mt-4 pt-4 border-t border-white/10">
               <PlayerList players={bluePlayers} currentPlayerId={$player.id} />
             </div>
          </Card.Content>
        </Card.Root>
      </div>
      
      <button class="px-12 py-4 text-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg rounded-lg transform transition-transform hover:scale-105" onclick={() => room.setStatus('playing')}>
        Start Game
      </button>
    </div>
  {:else}
    <div class="flex-1 relative px-4 sm:px-8 py-2 flex flex-col min-h-0">
      
      <!-- Status Banner Overlay -->
      <div class="flex justify-center items-center mb-2 relative min-h-[50px] gap-4 z-20">
          <StatusBanner 
            message={statusMessage} 
            type={$game.status === 'finished' ? ($game.winner === 'red' ? 'red' : 'blue') : ($game.currentTurn === 'red' ? 'red' : 'blue')}
          />
          {#if $canGuess && $game.guessesRemaining > 0}
             <button 
                class="ml-4 font-bold shadow-md animate-pulse bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md" 
                onclick={() => game.endTurn()}
             >
                End Turn
             </button>
          {/if}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[300px_1fr_300px] gap-4 h-full items-start overflow-hidden">
        <!-- Left Column: Red Team -->
        <div class="hidden lg:block h-full overflow-hidden">
          <TeamPanel 
            team="red" 
            score={redScore} 
            players={redPlayers} 
            isActive={$game.currentTurn === 'red'} 
          />
        </div>

        <!-- Center Column: Board -->
        <div class="h-full overflow-y-auto flex items-center justify-center p-2 relative">
          <Board 
            cards={$visibleCards} 
            canInteract={$canGuess}
            oncardclick={handleCardClick}
          />
        </div>

        <!-- Right Column: Blue Team + Log -->
        <div class="hidden lg:flex flex-col gap-4 h-full overflow-hidden items-start pb-4">
          <div class="shrink-0 w-full">
             <TeamPanel 
                team="blue" 
                score={blueScore} 
                players={bluePlayers} 
                isActive={$game.currentTurn === 'blue'} 
              />
          </div>
          <div class="flex-1 min-h-0 w-full mb-2">
             <GameLog entries={$game.log} />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Clue Input at Bottom (Fixed Position) -->
    {#if $canGiveClue}
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <ClueInput onsubmit={handleClueSubmit} />
      </div>
    {/if}
  {/if}

  <NicknameDialog open={showNickname} onsubmit={handleNicknameSubmit} />
  
  <!-- Players Dialog -->
  {#if showPlayers}
    <div 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
      role="button"
      tabindex="0"
      onclick={() => showPlayers = false}
      onkeydown={(e) => e.key === 'Escape' && (showPlayers = false)}
    >
      <div 
        class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="players-dialog-title"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 id="players-dialog-title" class="text-2xl font-bold text-gray-800">All Players ({$room.players.length})</h2>
            <button 
              class="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              onclick={() => showPlayers = false}
            >
              ×
            </button>
          </div>
          
          <div class="space-y-2 max-h-96 overflow-y-auto">
            {#each $room.players as p (p.id)}
              <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-800">{p.nickname}</span>
                </div>
                <div class="flex items-center gap-2">
                  {#if p.team}
                    <span class="text-xs px-2 py-1 rounded-full font-medium {p.team === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                      {p.team === 'red' ? 'Red' : 'Blue'}
                    </span>
                  {/if}
                  {#if p.role === 'spymaster'}
                    <span class="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700 font-medium">
                      🕵️
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
