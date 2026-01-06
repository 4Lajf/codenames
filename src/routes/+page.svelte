<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { session } from '$lib/stores/session';
  import { room } from '$lib/stores/room';
  import { socketConnected, socketError } from '$lib/stores/socket';
  
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";

  let roomCode = $state('');
  let nickname = $state('');
  let customWords = $state('');
  let wordList = $state<string[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Load saved nickname and word list
  onMount(async () => {
    const savedNickname = localStorage.getItem('codenames_nickname');
    if (savedNickname) {
      nickname = savedNickname;
    }

    // Load recently used custom words
    const savedCustomWords = localStorage.getItem('codenames_custom_words');
    if (savedCustomWords) {
      customWords = savedCustomWords;
    }

    // Check if word list is already in localStorage
    const savedWordList = localStorage.getItem('codenames_word_list');
    if (savedWordList) {
      try {
        wordList = JSON.parse(savedWordList);
      } catch (e) {
        console.error('Failed to parse saved word list', e);
      }
    }

    // If no saved word list, fetch from server
    if (wordList.length === 0 && browser) {
      try {
        const response = await fetch('/words.txt');
        const text = await response.text();
        wordList = text.split('\n').map(w => w.trim()).filter(w => w.length === 6);
        
        // Save to localStorage for next time
        localStorage.setItem('codenames_word_list', JSON.stringify(wordList));
      } catch (e) {
        console.error('Failed to load words.txt', e);
      }
    }
  });

  async function initSession(): Promise<boolean> {
    if (!nickname.trim()) {
      error = 'Please enter a nickname';
      return false;
    }

    isLoading = true;
    error = null;

    const success = await session.init(nickname.trim());
    
    if (!success) {
      error = 'Failed to create session. Please try again.';
      isLoading = false;
      return false;
    }

    // Wait for socket connection
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!$socketConnected) {
      error = 'Failed to connect to server. Please try again.';
      isLoading = false;
      return false;
    }

    // Initialize room store listeners
    room.init();

    return true;
  }

  async function handleCreateRoom() {
    if (!browser) return;
    
    const sessionOk = await initSession();
    if (!sessionOk) return;

    // Save nickname to localStorage
    localStorage.setItem('codenames_nickname', nickname.trim());
    
    // Store custom words if provided
    if (customWords.trim()) {
      localStorage.setItem('codenames_custom_words', customWords.trim());
    }
    
    // Generate room code from word list
    let newCode;
    if (wordList.length > 0) {
      newCode = wordList[Math.floor(Math.random() * wordList.length)].toUpperCase();
    } else {
      newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    // Parse custom words into array
    const parsedCustomWords = customWords.trim().split('\n').map(w => w.trim()).filter(w => w.length > 0);
    
    // Create room via socket
    const result = await room.create(newCode, parsedCustomWords.length >= 25 ? parsedCustomWords : undefined);
    
    if (!result.success) {
      error = result.error || 'Failed to create room';
      isLoading = false;
      return;
    }

    isLoading = false;
    goto(`/room/${newCode}`);
  }

  async function handleJoinRoom() {
    if (!browser) return;
    
    if (!roomCode.trim()) {
      error = 'Please enter a room code';
      return;
    }

    const sessionOk = await initSession();
    if (!sessionOk) return;

    // Save nickname
    localStorage.setItem('codenames_nickname', nickname.trim());

    const code = roomCode.toUpperCase().trim();

    // First check if room exists (only in browser)
    try {
      const response = await fetch(`/api/room/${code}`);
      if (!response.ok) {
        const data = await response.json();
        error = data.error || 'Room not found';
        isLoading = false;
        return;
      }
    } catch (e) {
      error = 'Failed to check room. Please try again.';
      isLoading = false;
      return;
    }

    // Join room via socket
    const result = await room.join(code);
    
    if (!result.success) {
      error = result.error || 'Failed to join room';
      isLoading = false;
      return;
    }

    isLoading = false;
    goto(`/room/${code}`);
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-[#5a1a1a] font-sans">
  <div class="w-full max-w-md space-y-8">
    
    <!-- Main Welcome Card -->
    <Card.Root class="border-0 shadow-2xl bg-white rounded-2xl overflow-hidden">
      <Card.Header class="text-center pt-8 pb-2 space-y-2">
        <Card.Title class="text-2xl font-bold tracking-tight text-gray-900">
          Welcome to Codenames
        </Card.Title>
      </Card.Header>

      <Card.Content class="space-y-6 px-8 pb-10">
        {#if error}
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        {/if}

        <div class="space-y-4">
          <div class="text-center text-gray-600">
            To enter the room, choose a nickname.
          </div>
          
          <Input 
            type="text" 
            bind:value={nickname} 
            placeholder="Enter your nickname" 
            disabled={isLoading}
            class="h-12 text-center text-lg border-gray-300 rounded-full focus-visible:ring-offset-0 focus-visible:ring-yellow-400 focus-visible:border-yellow-400"
          />
          
          <Button 
            onclick={handleCreateRoom}
            disabled={!nickname.trim() || isLoading}
            class="w-full h-12 text-lg font-bold bg-[#FFD700] hover:bg-[#FFC000] text-black rounded-full shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              Creating...
            {:else}
              Create Room
            {/if}
          </Button>
        </div>

        <!-- Divider -->
        <div class="relative py-2">
            <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t border-gray-200"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-white px-2 text-gray-400">Or Join Existing</span>
            </div>
        </div>

        <!-- Join Room Section -->
        <div class="space-y-3">
             <div class="flex gap-2">
                 <Input 
                    type="text"
                    bind:value={roomCode}
                    placeholder="Room Word (e.g. ANIMAL)" 
                    maxlength={20}
                    disabled={isLoading}
                    class="h-10 text-center uppercase tracking-widest border-gray-300 rounded-lg"
                  />
                 <Button 
                    onclick={handleJoinRoom}
                    disabled={!nickname.trim() || !roomCode.trim() || isLoading}
                    variant="secondary"
                    class="h-10 px-6 font-bold"
                 >
                    {#if isLoading}
                      ...
                    {:else}
                      Join
                    {/if}
                 </Button>
             </div>
        </div>
        
        <!-- Custom Words Import -->
        <div class="pt-4 border-t border-gray-100 space-y-3">
            <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Word List (One per line)</Label>
            <Textarea 
              bind:value={customWords}
              placeholder="Enter custom words here..."
              rows={10}
              disabled={isLoading}
              class="text-sm border-gray-200 resize-none h-[240px] overflow-y-auto"
            />
            <p class="text-xs text-gray-400">Minimum 25 words required for a game.</p>
        </div>

      </Card.Content>
    </Card.Root>

    <!-- Connection Status -->
    {#if $socketError}
      <div class="text-center text-red-300 text-sm">
        Connection error: {$socketError}
      </div>
    {/if}

  </div>
</div>
