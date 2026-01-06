<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { scale } from 'svelte/transition';
  import { Shuffle, Crown } from '@lucide/svelte';
  
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
  let showProfileMenu = $state(false);
  let isResetting = $state(false);
  let error = $state<string | null>(null);
  let didRefreshOnStatus = $state(false);

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
    if (!browser) return;
    
    // First check if room exists
    try {
      const response = await fetch(`/api/room/${roomCode}`);
      
      if (response.ok) {
        // Room exists, join it
        const result = await room.join(roomCode);
        if (!result.success) {
          error = result.error || 'Failed to join room';
          return;
        }
      } else {
        // Room doesn't exist, create it
        const result = await room.create(roomCode);
        if (!result.success) {
          error = result.error || 'Failed to create room';
          return;
        }
        // Server now auto-starts the game on creation
      }

      // Always refresh game state to get the cards if room is playing
      if ($room.status === 'playing') {
        await game.refresh();
        didRefreshOnStatus = true;
      }
    } catch (e) {
      if (browser) {
        error = 'Failed to connect to server';
      }
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
  let unassignedPlayers = $derived($room.players.filter(p => p.team === null));
  let redScore = $derived($game.scores.red);
  let blueScore = $derived($game.scores.blue);
  let isHost = $derived($room.hostId === $session.playerId);
  let myPlayer = $derived($room.players.find(p => p.id === $session.playerId));
  let cardMarkers = $derived($game.cardMarkers || {});

  let showCluePopup = $state(false);
  let lastClue = $state<{word: string, count: number} | null>(null);

  $effect(() => {
    // Detect new clue for popup
    if ($game.clue) {
      const isNew = !lastClue || $game.clue.word !== lastClue.word || $game.clue.count !== lastClue.count;
      if (isNew) {
        lastClue = $game.clue;
        showCluePopup = true;
        setTimeout(() => showCluePopup = false, 3000);
      }
    } else {
      lastClue = null;
    }
  });

  let bgClass = $derived.by(() => {
    // Always use team-based background (solid, subtle)
    if (myPlayer?.team === 'red') return 'bg-[#5a1a1a]';
    if (myPlayer?.team === 'blue') return 'bg-[#1a2f4a]';
    
    // Default to dimmed red for spectators or unassigned
    return 'bg-[#5a1a1a]';
  });

  let headerBgClass = $derived.by(() => {
    // Team-based header colors (check team first)
    if (myPlayer?.team === 'blue') return 'bg-blue-800/50';
    if (myPlayer?.team === 'red') return 'bg-red-800/50';
    // Default for spectators or unassigned
    return 'bg-red-900/40';
  });

  function getStatusMessage(state: any) {
    if (state.status === 'finished') {
      return state.winner === 'red' ? 'Red Team Wins!' : 'Blue Team Wins!';
    }
    if (state.status === 'playing') {
      const team = state.currentTurn;
      if (!team) return 'Waiting for game...';
      const turnMsg = team === 'red' ? 'Red Team is playing' : 'Blue Team is playing';
      if (state.clue) return `${turnMsg} - guess! (${state.guessesRemaining} left)`;
      return `${turnMsg} - waiting for clue...`;
    }
    return 'Game is starting...';
  }

  async function handleCardClick(index: number) {
    if ($canGuess) {
      const result = await game.revealCard(index);
      if (!result.success) {
        error = result.error || 'Failed to reveal card';
      }
    }
  }

  async function handleCardMark(index: number) {
    // Only allow marking if in a team
    if (!myPlayer?.team) return;
    
    const result = await game.markCard(index);
    if (!result.success) {
      error = result.error || 'Failed to mark card';
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

  async function handleChangeRole(team: 'red' | 'blue', role: 'operative' | 'spymaster') {
    const success = await playerActions.joinTeam(team, role);
    if (!success) {
      error = `Failed to change to ${role}`;
    }
  }

  async function handleEndTurn() {
    const result = await game.endTurn();
    if (!result.success) {
      error = result.error || 'Failed to end turn';
    }
  }

  async function handleResetGame() {
    if (!isHost) return;
    
    isResetting = true;
    error = null;

    const result = await game.resetGame();
    
    if (!result.success) {
      error = result.error || 'Failed to reset game';
    }
    
    isResetting = false;
  }

  function handleLeaveRoom() {
    room.leave();
    goto('/');
  }

  async function handleRandomizeTeams() {
    if (!isHost) return;
    
    const result = await room.randomizeTeams();
    if (!result.success) {
      error = result.error || 'Failed to randomize teams';
    }
  }

  async function handleTransferHost(playerId: string) {
    if (!isHost) return;
    
    const result = await room.transferHost(playerId);
    if (!result.success) {
      error = result.error || 'Failed to transfer host';
    }
  }

  async function handleBecomeSpectator() {
    const success = await playerActions.leaveTeam();
    if (!success) {
      error = 'Failed to become spectator';
    }
  }

  // Close players dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showPlayers && !target.closest('.players-dropdown-container')) {
      showPlayers = false;
    }
  }

  // If room status flips to playing/finished (e.g. host starts), ensure we load game state
  $effect(() => {
    if (!didRefreshOnStatus && $room.status !== 'waiting' && $game.status === 'lobby') {
      didRefreshOnStatus = true;
      game.refresh();
    }
  });
</script>

<svelte:window onclick={handleClickOutside} />

<div class={`h-screen flex flex-col overflow-hidden transition-colors duration-700 ease-in-out ${bgClass}`}>
  <!-- Top Header Bar -->
  <header class={`h-[40px] flex justify-between items-center px-4 z-30 backdrop-blur-sm transition-colors duration-700 ease-in-out ${headerBgClass}`}>
      <div class="flex items-center gap-2">
          <!-- Players dropdown -->
          <div class="relative players-dropdown-container">
            <button 
              class="bg-yellow-400 text-black hover:bg-yellow-500 rounded-full font-bold shadow-md px-4 py-1.5 text-sm"
              onclick={() => showPlayers = !showPlayers}
            >
              Players 👤 {$room.players.length}
            </button>
            
            {#if showPlayers}
              <div 
                class="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50"
              >
                <!-- Randomize teams button at top -->
                {#if isHost}
                  <button 
                    class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={handleRandomizeTeams}
                    disabled={$room.players.length < 4}
                  >
                    <Shuffle size={16} />
                    Randomize Teams
                    {#if $room.players.length < 4}
                      <span class="text-xs opacity-70">(need 4+)</span>
                    {/if}
                  </button>
                {/if}
                
                <div class="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                  All Players ({$room.players.length})
                </div>
                
                <div class="max-h-80 overflow-y-auto">
                  {#each $room.players as p (p.id)}
                    <div class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="font-medium text-gray-800 truncate">{p.nickname}</span>
                        {#if p.id === $room.hostId}
                          <Crown size={14} class="text-yellow-500 shrink-0" />
                        {/if}
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        {#if p.team}
                          <span class="text-xs px-2 py-0.5 rounded-full font-medium {p.team === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                            {p.team === 'red' ? 'Red' : 'Blue'}
                          </span>
                        {:else}
                          <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            Unassigned
                          </span>
                        {/if}
                        {#if p.role === 'spymaster'}
                          <span class="text-xs">🕵️</span>
                        {/if}
                        {#if isHost && p.id !== $room.hostId}
                          <button 
                            class="text-xs px-2 py-0.5 rounded bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors"
                            onclick={() => handleTransferHost(p.id)}
                          >
                            👑
                          </button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
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
          <div class="relative">
            <button
              class="bg-orange-500 text-white rounded-full px-4 py-1.5 text-sm font-bold shadow-md hover:bg-orange-600 transition-colors"
              onclick={() => showProfileMenu = !showProfileMenu}
            >
              {$session.nickname || 'Guest'} 👤
            </button>

            {#if showProfileMenu}
              <div
                class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50"
                role="menu"
              >
                <div class="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                  Team / Role (anytime)
                </div>

                <button
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleBecomeSpectator(); showProfileMenu = false; }}
                >
                  Spectator {myPlayer?.team === null ? '✓' : ''}
                </button>

                <div class="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-500">Red</div>
                <button
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('red', 'operative'); showProfileMenu = false; }}
                >
                  Operative {myPlayer?.team === 'red' && myPlayer?.role === 'operative' ? '✓' : ''}
                </button>
                <button
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('red', 'spymaster'); showProfileMenu = false; }}
                >
                  Spymaster {myPlayer?.team === 'red' && myPlayer?.role === 'spymaster' ? '✓' : ''}
                </button>

                <div class="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-500">Blue</div>
                <button
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('blue', 'operative'); showProfileMenu = false; }}
                >
                  Operative {myPlayer?.team === 'blue' && myPlayer?.role === 'operative' ? '✓' : ''}
                </button>
                <button
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('blue', 'spymaster'); showProfileMenu = false; }}
                >
                  Spymaster {myPlayer?.team === 'blue' && myPlayer?.role === 'spymaster' ? '✓' : ''}
                </button>
              </div>
            {/if}
          </div>
      </div>
  </header>

  {#if error}
    <div class="mx-4 mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm flex justify-between items-center">
      <span>{error}</span>
      <button onclick={() => error = null} class="text-red-700 font-bold">×</button>
    </div>
  {/if}

  <!-- Always show game board view -->
    <div class="flex-1 relative px-4 sm:px-8 py-2 flex flex-col min-h-0">
      
      <!-- Status Banner Overlay -->
      <div class="flex flex-wrap justify-center items-center mb-2 relative min-h-[50px] gap-4 z-20">
          <StatusBanner 
            message={statusMessage} 
            type={$game.status === 'finished' ? ($game.winner === 'red' ? 'red' : 'blue') : ($game.currentTurn === 'red' ? 'red' : 'blue')}
          />
          {#if $canGuess && $game.guessesRemaining > 0}
             <button 
                class="font-bold shadow-md text-white px-4 py-2 rounded-md transition-colors {myPlayer?.team === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}" 
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
            showJoinButtons={true}
            currentPlayerTeam={myPlayer?.team || null}
            currentPlayerRole={myPlayer?.role || null}
            onjoinoperative={() => handleChangeRole('red', 'operative')}
            onjoinspymaster={() => handleChangeRole('red', 'spymaster')}
          />
        </div>

        <!-- Center Column: Board -->
        <div class="h-full overflow-y-auto flex items-center justify-center p-2 relative">
          {#if $visibleCards.length > 0}
            <Board 
              cards={$visibleCards} 
              canInteract={$canGuess}
              markers={cardMarkers}
              myTeam={myPlayer?.team || null}
              oncardclick={handleCardClick}
              oncardmark={handleCardMark}
            />
          {/if}
        </div>

        <!-- Right Column: Blue Team + Log -->
        <div class="hidden lg:flex flex-col gap-4 h-full overflow-hidden items-start pb-4">
          <div class="shrink-0 w-full">
             <TeamPanel 
                team="blue" 
                score={blueScore} 
                players={bluePlayers} 
                isActive={$game.currentTurn === 'blue'}
                showJoinButtons={true}
                currentPlayerTeam={myPlayer?.team || null}
                currentPlayerRole={myPlayer?.role || null}
                onjoinoperative={() => handleChangeRole('blue', 'operative')}
                onjoinspymaster={() => handleChangeRole('blue', 'spymaster')}
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

    <!-- New Game Button at Bottom (Fixed Position) -->
    {#if $game.status === 'finished' && isHost}
      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <button 
          class="font-bold shadow-md bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-md transition-colors disabled:opacity-50" 
          onclick={handleResetGame}
          disabled={isResetting}
        >
          {isResetting ? 'Resetting...' : '🔄 New Game'}
        </button>
      </div>
    {/if}

    <!-- Persistent Clue Display -->
    {#if $game.clue}
       <div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
          <div class="bg-white text-black px-8 py-3 rounded-lg shadow-2xl border border-gray-300 flex items-center gap-3">
             <span class="text-3xl font-black tracking-wide uppercase">{$game.clue.word}</span>
             <span class="text-2xl font-bold bg-gray-200 px-3 py-1 rounded-md">{$game.clue.count}</span>
          </div>
       </div>
    {/if}

    <!-- New Clue Popup -->
    {#if showCluePopup && $game.clue}
       <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" transition:scale={{ start: 0.9, duration: 300 }}>
          <div class="bg-white text-black px-12 py-6 rounded-lg shadow-2xl border border-gray-300 flex items-center gap-4">
             <span class="text-5xl font-black tracking-wide uppercase">{$game.clue.word}</span>
             <span class="text-4xl font-bold bg-gray-200 px-4 py-2 rounded-md">{$game.clue.count}</span>
          </div>
       </div>
    {/if}

  <NicknameDialog open={showNickname} onsubmit={handleNicknameSubmit} />
</div>
