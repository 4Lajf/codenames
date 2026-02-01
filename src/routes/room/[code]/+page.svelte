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
  import Timer from '$lib/components/Timer.svelte';
  
  import * as Card from "$lib/components/ui/card";

  import { session } from '$lib/stores/session';
  import { game, isMyTurn, canGuess, canGiveClue, visibleCards, currentPlayer } from '$lib/stores/game';
  import { room } from '$lib/stores/room';
  import { socketConnected, getSocket } from '$lib/stores/socket';
  import { playerActions } from '$lib/stores/player';
  import { soundSettings } from '$lib/stores/sound';
  import { playRoundStartSound, primeAudio } from '$lib/utils/sound';

  let roomCode = $page.params.code;
  let showNickname = $state(false);
  let showPlayers = $state(false);
  let showProfileMenu = $state(false);
  let showTimerSettings = $state(false);
  let showSoundSettings = $state(false);
  let isResetting = $state(false);
  let error = $state<string | null>(null);
  let didRefreshOnStatus = $state(false);
  
  // Available sound files
  const soundFiles = [
    { value: 'rura.ogg', label: 'Rura' },
    { value: 'alohaaa.ogg', label: 'Alohaaa' },
    { value: 'fajaaaaa.ogg', label: 'Fajaaaaa' },
    { value: 'kiepscy.ogg', label: 'Kiepscy' },
    { value: 'sigma.ogg', label: 'Sigma' }
  ];
  
  // Spymaster local card selection (for preparing clues)
  let spymasterSelectedCards = $state(new Set<number>());

  onMount(async () => {
    const savedNickname = localStorage.getItem('codenames_nickname');
    const savedToken = localStorage.getItem('codenames_token');

    if (!savedToken || !savedNickname) {
      showNickname = true;
      return;
    }

    if (!$session.isAuthenticated) {
      const success = await session.init(savedNickname);
      if (!success) {
        showNickname = true;
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    room.init();
    game.init();

    if (!$room.code || $room.code !== roomCode) {
      await joinOrCreateRoom();
    }
  });

  async function joinOrCreateRoom() {
    if (!browser) return;
    
    try {
      const response = await fetch(`/api/room/${roomCode}`);
      
      if (response.ok) {
        const result = await room.join(roomCode);
        if (!result.success) {
          error = result.error || 'Failed to join room';
          return;
        }
      } else {
        // Room doesn't exist, show error and redirect to home
        error = 'Room not found. Please check the room code or create a new room.';
        setTimeout(() => {
          goto('/');
        }, 2000);
        return;
      }

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
      if (state.clue) return `${turnMsg} - guess! (${state.guessesRemaining === 999 ? '∞' : state.guessesRemaining} left)`;
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
    
    // Check if it's my team's turn
    if (!$isMyTurn) return;
    
    // Spymasters use local selection (not shared with team)
    if (myPlayer?.role === 'spymaster') {
      // Toggle card in spymaster selection
      const newSet = new Set(spymasterSelectedCards);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      spymasterSelectedCards = newSet;
      return;
    }
    
    // Operatives use shared team marking
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
      } else {
        // Clear spymaster selections after giving clue
        spymasterSelectedCards = new Set();
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

  async function handleKickPlayer(playerId: string) {
    if (!isHost) return;
    
    const result = await room.kickPlayer(playerId);
    if (!result.success) {
      error = result.error || 'Failed to kick player';
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

  // Clear spymaster selections when turn changes or game resets
  let lastTurn = $state<'red' | 'blue' | null>(null);
  let lastGameStatus = $state<string | null>(null);
  let lastClueState = $state<boolean>(false);
  
  $effect(() => {
    // Clear selections when turn changes
    if (lastTurn !== null && lastTurn !== $game.currentTurn) {
      spymasterSelectedCards = new Set();
      Object.keys(cardMarkers).forEach(async (key) => {
        const position = parseInt(key);
        if (cardMarkers[position]?.some(m => m.nickname === $session.nickname)) {
          await game.markCard(position);
        }
      });
    }
    lastTurn = $game.currentTurn;

    // Clear selections when game resets
    if (lastGameStatus !== null && lastGameStatus !== 'lobby' && $game.status === 'lobby') {
      spymasterSelectedCards = new Set();
    }
    lastGameStatus = $game.status;
  });

  // Timer management - now handled by server, no local interval needed

  // Start timer when turn changes or clue is given
  $effect(() => {
    const hasClue = $game.clue !== null;
    const turnChanged = lastTurn !== null && lastTurn !== $game.currentTurn;
    const clueGiven = !lastClueState && hasClue;
    
    if ($game.status === 'playing' && $game.timerSettings.enabled) {
      if (turnChanged) {
        // New turn started - spymaster phase
        game.startTimer($game.currentTurn, true);
        if (lastTurn !== null) {
          // Mark previous team's first round as complete
          game.completeFirstRound(lastTurn);
        }
      } else if (clueGiven) {
        // Clue was given - operative phase
        game.startTimer($game.currentTurn, false);
      }
    }
    
    lastClueState = hasClue;
  });

  async function handleTimerToggle(team: 'red' | 'blue') {
    // Only allow team members to pause their own timer
    if (myPlayer?.team === team) {
      try {
        const result = await game.toggleTimerPause(team);
        if (!result.success) {
          error = result.error || 'Failed to toggle timer';
        }
      } catch (err: any) {
        error = err.message || 'Failed to toggle timer';
      }
    }
  }

  async function handleTimerSettingsChange(settings: Partial<typeof $game.timerSettings>) {
    if (!isHost) return;
    const result = await game.updateTimerSettings(settings);
    if (!result.success) {
      error = result.error || 'Failed to update timer settings';
    }
  }

  async function handleTestSound() {
    await primeAudio();
    await playRoundStartSound($soundSettings.soundFile, $soundSettings.gain);
  }

  // Sound notification on turn change
  let previousTurn = $state<'red' | 'blue' | null>(null);
  let hasSeenTurn = $state(false);
  
  $effect(() => {
    // Play sound when turn changes to my team
    if ($game.status === 'playing' && $game.currentTurn && myPlayer?.team) {
      const isMyTeamTurn = $game.currentTurn === myPlayer.team;
      const turnChanged = hasSeenTurn && previousTurn !== null && previousTurn !== $game.currentTurn;
      
      if (isMyTeamTurn && turnChanged && $soundSettings.enabled) {
        playRoundStartSound($soundSettings.soundFile, $soundSettings.gain);
      }
      
      previousTurn = $game.currentTurn;
      hasSeenTurn = true;
    } else if ($game.status !== 'playing') {
      previousTurn = null;
      hasSeenTurn = false;
    }
  });
</script>

<svelte:window onclick={handleClickOutside} />

<div class={`h-dvh flex flex-col overflow-hidden transition-colors duration-700 ease-in-out ${bgClass}`}>
  <!-- Top Header Bar -->
  <header class={`h-[36px] sm:h-[40px] flex justify-between items-center px-2 sm:px-4 z-30 backdrop-blur-sm transition-colors duration-700 ease-in-out shrink-0 ${headerBgClass}`}>
      <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- Players dropdown -->
          <div class="relative players-dropdown-container">
            <button 
              class="bg-yellow-400 text-black hover:bg-yellow-500 rounded-full font-bold shadow-md px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm"
              onclick={() => showPlayers = !showPlayers}
            >
              <span class="hidden sm:inline">Players </span>👤 {$room.players.length}
            </button>
            
            {#if showPlayers}
              <div 
                class="absolute left-0 top-full mt-2 w-64 sm:w-80 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50"
              >
                <!-- Host controls -->
                {#if isHost}
                  <div class="border-b border-gray-200">
                    <button 
                      class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onclick={handleRandomizeTeams}
                      disabled={$room.players.length < 4}
                    >
                      <Shuffle size={14} class="sm:w-4 sm:h-4" />
                      Randomize Teams
                      {#if $room.players.length < 4}
                        <span class="text-[10px] sm:text-xs opacity-70">(need 4+)</span>
                      {/if}
                    </button>
                    
                    <button 
                      class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                      onclick={() => showTimerSettings = !showTimerSettings}
                    >
                      ⏱️ Timer Settings
                    </button>
                    
                    {#if showTimerSettings}
                      <div class="px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 border-t border-gray-200 space-y-2 sm:space-y-3">
                        <label class="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={$game.timerSettings.enabled}
                            onchange={(e) => handleTimerSettingsChange({ enabled: e.currentTarget.checked })}
                            class="w-4 h-4"
                          />
                          <span class="text-xs sm:text-sm font-medium text-gray-700">Enable Timers</span>
                        </label>
                        
                        {#if $game.timerSettings.enabled}
                          <div class="space-y-2 sm:space-y-2.5">
                            <div>
                              <label for="spymaster-duration" class="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                                Spymaster Duration (seconds)
                              </label>
                              <input 
                                id="spymaster-duration"
                                type="number" 
                                min="0" 
                                step="10"
                                value={$game.timerSettings.spymasterDuration}
                                onchange={(e) => handleTimerSettingsChange({ spymasterDuration: parseInt(e.currentTarget.value) || 0 })}
                                class="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            
                            <div>
                              <label for="operative-duration" class="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                                Operative Duration (seconds)
                              </label>
                              <input 
                                id="operative-duration"
                                type="number" 
                                min="0" 
                                step="10"
                                value={$game.timerSettings.operativeDuration}
                                onchange={(e) => handleTimerSettingsChange({ operativeDuration: parseInt(e.currentTarget.value) || 0 })}
                                class="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            
                            <div>
                              <label for="first-round-bonus" class="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                                First Round Bonus (seconds)
                              </label>
                              <input 
                                id="first-round-bonus"
                                type="number" 
                                min="0" 
                                step="10"
                                value={$game.timerSettings.firstRoundBonus}
                                onchange={(e) => handleTimerSettingsChange({ firstRoundBonus: parseInt(e.currentTarget.value) || 0 })}
                                class="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
                
                <div class="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                  All Players ({$room.players.length})
                </div>
                
                <div class="max-h-60 sm:max-h-80 overflow-y-auto">
                  {#each $room.players as p (`${p.id}-${p.nickname}`)}
                    <div class="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                      <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span class="font-medium text-gray-800 truncate text-xs sm:text-sm max-w-[80px] sm:max-w-none">{p.nickname}</span>
                        {#if p.id === $room.hostId}
                          <Crown size={12} class="sm:w-3.5 sm:h-3.5 text-yellow-500 shrink-0" />
                        {/if}
                      </div>
                      <div class="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        {#if p.team}
                          <span class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium {p.team === 'red' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">
                            {p.team === 'red' ? 'Red' : 'Blue'}
                          </span>
                        {:else}
                          <span class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            <span class="hidden sm:inline">Unassigned</span>
                            <span class="sm:hidden">-</span>
                          </span>
                        {/if}
                        {#if p.role === 'spymaster'}
                          <span class="text-[10px] sm:text-xs">🕵️</span>
                        {/if}
                        {#if isHost && p.id !== $session.playerId}
                          <button 
                            class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                            onclick={() => handleKickPlayer(p.id)}
                            title="Kick player"
                          >
                            ❌
                          </button>
                          {#if p.id !== $room.hostId}
                            <button 
                              class="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-yellow-500 hover:bg-yellow-600 text-white font-medium transition-colors"
                              onclick={() => handleTransferHost(p.id)}
                              title="Make host"
                            >
                              👑
                            </button>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
          <button 
            class="bg-gray-600 text-white hover:bg-gray-700 rounded-full font-medium shadow-md px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm"
            onclick={handleLeaveRoom}
          >
            Leave
          </button>
      </div>
      <div class="flex items-center gap-1.5 sm:gap-2">
          {#if !$socketConnected}
            <span class="text-red-300 text-xs sm:text-sm">Offline</span>
          {/if}
          <div class="relative">
            <button
              class="bg-orange-500 text-white rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold shadow-md hover:bg-orange-600 transition-colors max-w-[100px] sm:max-w-none truncate"
              onclick={() => showProfileMenu = !showProfileMenu}
            >
              <span class="truncate">{$session.nickname || 'Guest'}</span> 👤
            </button>

            {#if showProfileMenu}
              <div
                class="absolute right-0 mt-2 w-52 sm:w-64 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50"
                role="menu"
              >
                <div class="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">
                  Team / Role (anytime)
                </div>

                <button
                  class="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleBecomeSpectator(); showProfileMenu = false; }}
                >
                  Spectator {myPlayer?.team === null ? '✓' : ''}
                </button>

                <div class="px-2 sm:px-3 pt-1.5 sm:pt-2 pb-0.5 sm:pb-1 text-[10px] sm:text-[11px] font-semibold text-gray-500">Red</div>
                <button
                  class="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('red', 'operative'); showProfileMenu = false; }}
                >
                  Operative {myPlayer?.team === 'red' && myPlayer?.role === 'operative' ? '✓' : ''}
                </button>
                <button
                  class="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('red', 'spymaster'); showProfileMenu = false; }}
                >
                  Spymaster {myPlayer?.team === 'red' && myPlayer?.role === 'spymaster' ? '✓' : ''}
                </button>

                <div class="px-2 sm:px-3 pt-1.5 sm:pt-2 pb-0.5 sm:pb-1 text-[10px] sm:text-[11px] font-semibold text-gray-500">Blue</div>
                <button
                  class="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('blue', 'operative'); showProfileMenu = false; }}
                >
                  Operative {myPlayer?.team === 'blue' && myPlayer?.role === 'operative' ? '✓' : ''}
                </button>
                <button
                  class="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm hover:bg-gray-50 transition-colors"
                  onclick={async () => { await handleChangeRole('blue', 'spymaster'); showProfileMenu = false; }}
                >
                  Spymaster {myPlayer?.team === 'blue' && myPlayer?.role === 'spymaster' ? '✓' : ''}
                </button>

                <div class="px-2 sm:px-3 pt-1.5 sm:pt-2 pb-0.5 sm:pb-1 text-[10px] sm:text-[11px] font-semibold text-gray-500 border-t border-gray-100 mt-1">Sound Settings</div>
                
                <div class="px-2 sm:px-3 py-1.5 sm:py-2 space-y-2 sm:space-y-2.5">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={$soundSettings.enabled}
                      onchange={(e) => soundSettings.setEnabled(e.currentTarget.checked)}
                      class="w-4 h-4"
                    />
                    <span class="text-xs sm:text-sm font-medium text-gray-700">Enable Round Start Sound</span>
                  </label>
                  
                  {#if $soundSettings.enabled}
                    <div class="space-y-2">
                      <div>
                        <label for="sound-file" class="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                          Sound
                        </label>
                        <select
                          id="sound-file"
                          value={$soundSettings.soundFile}
                          onchange={(e) => soundSettings.setSoundFile(e.currentTarget.value)}
                          class="w-full px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          {#each soundFiles as file}
                            <option value={file.value}>{file.label}</option>
                          {/each}
                        </select>
                      </div>
                      
                      <div>
                        <label for="sound-volume" class="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">
                          Volume: {Math.round($soundSettings.gain * 100)}%
                        </label>
                        <input
                          id="sound-volume"
                          type="range"
                          min="0"
                          max="200"
                          step="1"
                          value={$soundSettings.gain * 100}
                          oninput={(e) => soundSettings.setGain(parseInt(e.currentTarget.value) / 100)}
                          class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div class="flex justify-between text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
                          <span>0%</span>
                          <span>200%</span>
                        </div>
                      </div>
                      
                      <button
                        class="w-full px-2 py-1.5 text-xs sm:text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        onclick={handleTestSound}
                      >
                        🔊 Test Sound
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
      </div>
  </header>

  {#if error}
    <div class="mx-2 sm:mx-4 mt-1 sm:mt-2 bg-red-100 border border-red-400 text-red-700 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm flex justify-between items-center gap-2 shrink-0">
      <span class="truncate">{error}</span>
      <button onclick={() => error = null} class="text-red-700 font-bold shrink-0 w-5 h-5 flex items-center justify-center">×</button>
    </div>
  {/if}

  <!-- Always show game board view -->
    <div class="flex-1 relative px-2 sm:px-4 lg:px-6 py-1 sm:py-2 flex flex-col min-h-0 overflow-hidden">
      
      <!-- Status Banner Overlay -->
      <div class="flex flex-wrap justify-center items-center mb-1 sm:mb-2 relative min-h-[36px] sm:min-h-[44px] gap-2 sm:gap-4 z-20">
          <StatusBanner 
            message={statusMessage} 
            type={$game.status === 'finished' ? ($game.winner === 'red' ? 'red' : 'blue') : ($game.currentTurn === 'red' ? 'red' : 'blue')}
          />
          {#if $canGuess && $game.guessesRemaining > 0}
             <button 
                class="font-bold shadow-md text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition-colors text-sm sm:text-base {myPlayer?.team === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}" 
                onclick={handleEndTurn}
             >
                End Turn
             </button>
          {/if}
      </div>

      <!-- Mobile Team Scores Bar (visible on small screens) -->
      <div class="flex lg:hidden justify-between items-stretch gap-2 mb-2 px-1">
        <div class="flex-1 bg-red-900/60 border border-red-700/60 rounded-lg p-2 flex flex-col gap-1 min-w-0">
          <div class="flex items-center justify-between">
            <div class="flex flex-col min-w-0">
              <span class="text-[10px] uppercase font-semibold text-red-300 tracking-wide">Red</span>
              <div class="flex flex-wrap gap-1">
                {#each redPlayers.slice(0, 2) as p (`red-${p.id}-${p.nickname}`)}
                  <span class="text-xs text-white/80 truncate max-w-[50px]">{p.nickname}</span>
                {/each}
                {#if redPlayers.length > 2}
                  <span class="text-xs text-white/60">+{redPlayers.length - 2}</span>
                {/if}
              </div>
            </div>
            <span class="text-2xl sm:text-3xl font-black text-white ml-2">{redScore}</span>
          </div>
          <Timer 
            timeRemaining={$game.teamTimers.red.timeRemaining}
            isPaused={$game.teamTimers.red.isPaused}
            isActive={$game.currentTurn === 'red'}
            team="red"
            canPause={myPlayer?.team === 'red'}
            ontoggle={() => handleTimerToggle('red')}
          />
        </div>
        <div class="flex-1 bg-blue-900/60 border border-blue-600/60 rounded-lg p-2 flex flex-col gap-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-2xl sm:text-3xl font-black text-white mr-2">{blueScore}</span>
            <div class="flex flex-col items-end min-w-0">
              <span class="text-[10px] uppercase font-semibold text-blue-300 tracking-wide">Blue</span>
              <div class="flex flex-wrap gap-1 justify-end">
                {#each bluePlayers.slice(0, 2) as p (`blue-${p.id}-${p.nickname}`)}
                  <span class="text-xs text-white/80 truncate max-w-[50px]">{p.nickname}</span>
                {/each}
                {#if bluePlayers.length > 2}
                  <span class="text-xs text-white/60">+{bluePlayers.length - 2}</span>
                {/if}
              </div>
            </div>
          </div>
          <Timer 
            timeRemaining={$game.teamTimers.blue.timeRemaining}
            isPaused={$game.teamTimers.blue.isPaused}
            isActive={$game.currentTurn === 'blue'}
            team="blue"
            canPause={myPlayer?.team === 'blue'}
            ontoggle={() => handleTimerToggle('blue')}
          />
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] xl:grid-cols-[260px_1fr_260px] 2xl:grid-cols-[300px_1fr_300px] gap-2 lg:gap-3 xl:gap-4 flex-1 min-h-0 overflow-hidden">
        <!-- Left Column: Red Team -->
        <div class="hidden lg:block min-h-0 overflow-y-auto">
          <TeamPanel 
            team="red" 
            score={redScore} 
            players={redPlayers} 
            isActive={$game.currentTurn === 'red'}
            showJoinButtons={true}
            currentPlayerTeam={myPlayer?.team || null}
            currentPlayerRole={myPlayer?.role || null}
            timeRemaining={$game.teamTimers.red.timeRemaining}
            isPaused={$game.teamTimers.red.isPaused}
            canPauseTimer={myPlayer?.team === 'red'}
            onjoinoperative={() => handleChangeRole('red', 'operative')}
            onjoinspymaster={() => handleChangeRole('red', 'spymaster')}
            ontimerToggle={() => handleTimerToggle('red')}
          />
        </div>

        <!-- Center Column: Board -->
        <div class="flex-1 min-h-0 flex items-start sm:items-center justify-center overflow-y-auto py-1 sm:py-2">
          {#if $visibleCards.length > 0}
            <div class="w-full max-w-full px-1 sm:px-2">
              <Board 
                cards={$visibleCards} 
                canInteract={$canGuess}
                markers={cardMarkers}
                myTeam={myPlayer?.team || null}
                spymasterSelectedCards={myPlayer?.role === 'spymaster' ? spymasterSelectedCards : new Set()}
                oncardclick={handleCardClick}
                oncardmark={handleCardMark}
              />
            </div>
          {/if}
        </div>

        <!-- Right Column: Blue Team + Log -->
        <div class="hidden lg:flex flex-col gap-2 xl:gap-3 min-h-0 overflow-hidden">
          <div class="shrink-0 w-full">
             <TeamPanel 
                team="blue" 
                score={blueScore} 
                players={bluePlayers} 
                isActive={$game.currentTurn === 'blue'}
                showJoinButtons={true}
                currentPlayerTeam={myPlayer?.team || null}
                currentPlayerRole={myPlayer?.role || null}
                timeRemaining={$game.teamTimers.blue.timeRemaining}
                isPaused={$game.teamTimers.blue.isPaused}
                canPauseTimer={myPlayer?.team === 'blue'}
                onjoinoperative={() => handleChangeRole('blue', 'operative')}
                onjoinspymaster={() => handleChangeRole('blue', 'spymaster')}
                ontimerToggle={() => handleTimerToggle('blue')}
              />
          </div>
          <div class="flex-1 min-h-0 w-full overflow-hidden">
             <GameLog entries={$game.log} />
          </div>
        </div>
      </div>
    </div>
    
    <!-- Clue Input at Bottom (Fixed Position) -->
    {#if $canGiveClue}
      <div class="fixed bottom-2 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-30 w-auto max-w-[95vw]">
        <ClueInput selectedCount={spymasterSelectedCards.size} onsubmit={handleClueSubmit} />
      </div>
    {/if}

    <!-- New Game Button at Bottom (Fixed Position) -->
    {#if $game.status === 'finished' && isHost}
      <div class="fixed bottom-2 sm:bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-30">
        <button 
          class="font-bold shadow-md bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-6 py-1.5 sm:py-2 rounded-md transition-colors disabled:opacity-50 text-sm sm:text-base" 
          onclick={handleResetGame}
          disabled={isResetting}
        >
          {isResetting ? 'Resetting...' : '🔄 New Game'}
        </button>
      </div>
    {/if}

    <!-- Persistent Clue Display -->
    {#if $game.clue}
       <div class="fixed bottom-2 sm:bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-4 pointer-events-none max-w-[95vw]">
          <div class="bg-white text-black px-4 sm:px-6 md:px-8 py-2 sm:py-3 rounded-lg shadow-2xl border border-gray-300 flex items-center gap-2 sm:gap-3">
             <span class="text-lg sm:text-2xl md:text-3xl font-black tracking-wide uppercase truncate max-w-[50vw]">{$game.clue.word}</span>
             <span class="text-base sm:text-xl md:text-2xl font-bold bg-gray-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md shrink-0">{$game.clue.count === 0 ? '∞' : $game.clue.count}</span>
          </div>
       </div>
    {/if}

    <!-- New Clue Popup -->
    {#if showCluePopup && $game.clue}
       <div class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4" transition:scale={{ start: 0.9, duration: 300 }}>
          <div class="bg-white text-black px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 rounded-lg shadow-2xl border border-gray-300 flex items-center gap-3 sm:gap-4 max-w-[90vw]">
             <span class="text-2xl sm:text-3xl md:text-5xl font-black tracking-wide uppercase truncate">{$game.clue.word}</span>
             <span class="text-xl sm:text-2xl md:text-4xl font-bold bg-gray-200 px-3 sm:px-4 py-1 sm:py-2 rounded-md shrink-0">{$game.clue.count === 0 ? '∞' : $game.clue.count}</span>
          </div>
       </div>
    {/if}

  <NicknameDialog open={showNickname} onsubmit={handleNicknameSubmit} />
</div>
