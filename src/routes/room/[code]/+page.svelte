<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  
  import Board from '$lib/components/Board.svelte';
  import TeamPanel from '$lib/components/TeamPanel.svelte';
  import GameLog from '$lib/components/GameLog.svelte';
  import StatusBanner from '$lib/components/StatusBanner.svelte';
  import ClueInput from '$lib/components/ClueInput.svelte';
  import PlayerList from '$lib/components/PlayerList.svelte';
  import NicknameDialog from '$lib/components/NicknameDialog.svelte';
  
  import * as Card from "$lib/components/ui/card";

  import { session } from '$lib/stores/session';
  import { game, isMyTurn, canGuess, canGiveClue, visibleCards, currentPlayer } from '$lib/stores/game';
  import { room } from '$lib/stores/room';
  import { socketConnected, getSocket } from '$lib/stores/socket';
  import { playerActions } from '$lib/stores/player';

  let roomCode = $page.params.code;
  let showNickname = $state(false);
  let showPlayers = $state(false);
  let isStarting = $state(false);
  let error = $state<string | null>(null);

  // Initialize on mount
  onMount(async () => {
    // Check if session exists
    const savedNickname = localStorage.getItem('codenames_nickname');
    const savedToken = localStorage.getItem('codenames_token');

    if (!savedToken || !savedNickname) {
      // Need to set nickname first
      showNickname = true;
      return;
    }

    // Initialize session if not already
    if (!$session.isAuthenticated) {
      const success = await session.init(savedNickname);
      if (!success) {
        showNickname = true;
        return;
      }

      // Wait for socket connection
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Initialize stores
    room.init();
    game.init();

    // If not in room, try to join
    if (!$room.code || $room.code !== roomCode) {
      await joinOrCreateRoom();
    }
  });

  async function joinOrCreateRoom() {
    // First check if room exists
    try {
      const response = await fetch(`/api/room/${roomCode}`);
      
      if (response.ok) {
        // Room exists, join it
        const result = await room.join(roomCode);
        if (!result.success) {
          error = result.error || 'Failed to join room';
        }
      } else {
        // Room doesn't exist, create it
        const result = await room.create(roomCode);
        if (!result.success) {
          error = result.error || 'Failed to create room';
        }
      }
    } catch (e) {
      error = 'Failed to connect to server';
    }
  }

  async function handleNicknameSubmit(name: string) {
    showNickname = false;
    localStorage.setItem('codenames_nickname', name);
    
    // Initialize session with nickname
    const success = await session.init(name);
    if (!success) {
      error = 'Failed to create session';
      return;
    }

    // Wait for socket
    await new Promise(resolve => setTimeout(resolve, 500));

    // Initialize stores
    room.init();
    game.init();

    // Join or create room
    await joinOrCreateRoom();
  }

  // Derived state for UI
  let statusMessage = $derived(getStatusMessage($game));
  let redPlayers = $derived($room.players.filter(p => p.team === 'red'));
  let bluePlayers = $derived($room.players.filter(p => p.team === 'blue'));
  let redScore = $derived($game.scores.red);
  let blueScore = $derived($game.scores.blue);
  let isHost = $derived($room.hostId === $session.playerId);
  let myPlayer = $derived($room.players.find(p => p.id === $session.playerId));

  function getStatusMessage(state: any) {
    if (state.status === 'finished') {
      return state.winner === 'red' ? 'Red Team Wins!' : 'Blue Team Wins!';
    }
    if (state.status === 'playing') {
      const turnMsg = state.currentTurn === 'red' ? 'Red Team is playing' : 'Blue Team is playing';
      if (state.clue) return `${turnMsg} - guess! (${state.guessesRemaining} left)`;
      return `${turnMsg} - waiting for clue...`;
    }
    return 'Waiting for game to start...';
  }

  async function handleCardClick(index: number) {
    if ($canGuess) {
      const result = await game.revealCard(index);
      if (!result.success) {
        error = result.error || 'Failed to reveal card';
      }
    }
  }

  async function handleClueSubmit(data: {word: string, count: number}) {
    if ($canGiveClue) {
      const result = await game.giveClue(data.word, data.count);
      if (!result.success) {
        error = result.error || 'Failed to give clue';
      }
    }
  }

  async function handleJoinTeam(team: 'red' | 'blue') {
    const success = await playerActions.joinTeam(team, 'operative');
    if (!success) {
      error = 'Failed to join team';
    }
  }

  async function handleBecomeSpymaster(team: 'red' | 'blue') {
    const success = await playerActions.joinTeam(team, 'spymaster');
    if (!success) {
      error = 'Failed to become spymaster (role may be taken)';
    }
  }

  async function handleStartGame() {
    if (!isHost) return;
    
    isStarting = true;
    error = null;

    const result = await game.start();
    
    if (!result.success) {
      error = result.error || 'Failed to start game';
    } else {
      room.setStatus('playing');
    }
    
    isStarting = false;
  }

  async function handleEndTurn() {
    const result = await game.endTurn();
    if (!result.success) {
      error = result.error || 'Failed to end turn';
    }
  }

  function handleLeaveRoom() {
    room.leave();
    goto('/');
  }
</script>

<div class="h-screen flex flex-col overflow-hidden bg-codenames-orange">
  <!-- Top Header Bar -->
  <header class="h-[40px] flex justify-between items-center px-4 z-10">
      <div class="flex items-center gap-2">
          <button 
            class="bg-yellow-400 text-black hover:bg-yellow-500 rounded-full font-bold shadow-md px-4 py-1.5 text-sm"
            onclick={() => showPlayers = true}
          >
            Players 👤 {$room.players.length}
          </button>
          <button 
            class="bg-gray-600 text-white hover:bg-gray-700 rounded-full font-medium shadow-md px-3 py-1.5 text-sm"
            onclick={handleLeaveRoom}
          >
            Leave
          </button>
      </div>
      <div class="flex items-center gap-2">
          {#if !$socketConnected}
            <span class="text-red-300 text-sm">Disconnected</span>
          {/if}
          <div class="bg-orange-500 text-white rounded-full px-4 py-1.5 text-sm font-bold shadow-md">
            {$session.nickname || 'Guest'} 👤
          </div>
      </div>
  </header>

  {#if error}
    <div class="mx-4 mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm flex justify-between items-center">
      <span>{error}</span>
      <button onclick={() => error = null} class="text-red-700 font-bold">×</button>
    </div>
  {/if}

  {#if $room.status === 'waiting' || $game.status === 'lobby'}
    <div class="p-8 text-center text-white overflow-auto flex-1 flex flex-col items-center">
      <h1 class="text-4xl font-bold mb-2 drop-shadow-md">Room: {roomCode}</h1>
      <p class="text-white/70 mb-8">Share this code with friends to join!</p>
      
      <div class="flex flex-wrap justify-center gap-8 mb-8 w-full max-w-4xl">
        <!-- Red Team Lobby -->
        <Card.Root class="w-[300px] bg-red-950/80 border-0 text-white overflow-hidden">
          <Card.Header class="bg-red-800 py-3">
             <Card.Title class="text-white text-center">Red Team</Card.Title>
          </Card.Header>
          <Card.Content class="p-4 space-y-3">
             <button 
               class="w-full bg-red-800/80 text-white hover:bg-red-700 px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50" 
               onclick={() => handleJoinTeam('red')}
               disabled={myPlayer?.team === 'red'}
             >
               {myPlayer?.team === 'red' && myPlayer?.role === 'operative' ? '✓ Operative' : 'Join as Operative'}
             </button>
             <button 
               class="w-full bg-red-800/80 text-white hover:bg-red-700 px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50" 
               onclick={() => handleBecomeSpymaster('red')}
               disabled={myPlayer?.team === 'red' && myPlayer?.role === 'spymaster'}
             >
               {myPlayer?.team === 'red' && myPlayer?.role === 'spymaster' ? '✓ Spymaster' : 'Become Spymaster'}
             </button>
             <div class="mt-4 pt-4 border-t border-white/10">
               <PlayerList players={redPlayers} currentPlayerId={$session.playerId || ''} />
             </div>
          </Card.Content>
        </Card.Root>

        <!-- Blue Team Lobby -->
        <Card.Root class="w-[300px] bg-blue-950/80 border-0 text-white overflow-hidden">
          <Card.Header class="bg-blue-800 py-3">
             <Card.Title class="text-white text-center">Blue Team</Card.Title>
          </Card.Header>
          <Card.Content class="p-4 space-y-3">
             <button 
               class="w-full bg-blue-800/80 text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50" 
               onclick={() => handleJoinTeam('blue')}
               disabled={myPlayer?.team === 'blue'}
             >
               {myPlayer?.team === 'blue' && myPlayer?.role === 'operative' ? '✓ Operative' : 'Join as Operative'}
             </button>
             <button 
               class="w-full bg-blue-800/80 text-white hover:bg-blue-700 px-4 py-2 rounded-md transition-colors font-medium disabled:opacity-50" 
               onclick={() => handleBecomeSpymaster('blue')}
               disabled={myPlayer?.team === 'blue' && myPlayer?.role === 'spymaster'}
             >
               {myPlayer?.team === 'blue' && myPlayer?.role === 'spymaster' ? '✓ Spymaster' : 'Become Spymaster'}
             </button>
             <div class="mt-4 pt-4 border-t border-white/10">
               <PlayerList players={bluePlayers} currentPlayerId={$session.playerId || ''} />
             </div>
          </Card.Content>
        </Card.Root>
      </div>
      
      {#if isHost}
        <button 
          class="px-12 py-4 text-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg rounded-lg transform transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" 
          onclick={handleStartGame}
          disabled={isStarting || redPlayers.length < 2 || bluePlayers.length < 2}
        >
          {#if isStarting}
            Starting...
          {:else}
            Start Game
          {/if}
        </button>
        {#if redPlayers.length < 2 || bluePlayers.length < 2}
          <p class="text-white/70 mt-2 text-sm">Need at least 2 players per team to start</p>
        {/if}
        {#if !redPlayers.some(p => p.role === 'spymaster') || !bluePlayers.some(p => p.role === 'spymaster')}
          <p class="text-white/70 mt-1 text-sm">Each team needs a spymaster</p>
        {/if}
      {:else}
        <p class="text-white/70">Waiting for host to start the game...</p>
      {/if}
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
                onclick={handleEndTurn}
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
                  {#if p.id === $room.hostId}
                    <span class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Host</span>
                  {/if}
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
