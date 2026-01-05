<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { player } from '$lib/stores/player';
  
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import * as Card from "$lib/components/ui/card";
  import { Label } from "$lib/components/ui/label";

  let roomCode = $state('');
  let nickname = $state('');
  let customWords = $state('');
  let wordList = $state<string[]>([]);

  // Load saved nickname if available
  onMount(async () => {
    const savedNickname = localStorage.getItem('codenames_nickname');
    if (savedNickname) {
      nickname = savedNickname;
    }

    try {
      const response = await fetch('/words.txt');
      const text = await response.text();
      wordList = text.split('\n').map(w => w.trim()).filter(w => w.length === 6);
    } catch (e) {
      console.error('Failed to load words.txt', e);
    }
  });

  function handleCreateRoom() {
    if (!nickname.trim()) return;
    // Save nickname to localStorage first
    localStorage.setItem('codenames_nickname', nickname.trim());
    player.updateNickname(nickname);
    // Store custom words if provided
    if (customWords.trim()) {
      localStorage.setItem('codenames_custom_words', customWords.trim());
    }
    
    let newCode;
    if (wordList.length > 0) {
      newCode = wordList[Math.floor(Math.random() * wordList.length)].toUpperCase();
    } else {
      // Fallback to random 6 letters if word list failed to load
      newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    goto(`/room/${newCode}`);
  }

  function handleJoinRoom() {
    if (!nickname.trim() || !roomCode.trim()) return;
    // Save nickname to localStorage first
    localStorage.setItem('codenames_nickname', nickname.trim());
    player.updateNickname(nickname);
    goto(`/room/${roomCode.toUpperCase().trim()}`);
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-codenames-orange font-sans">
  <div class="w-full max-w-md space-y-8">
    
    <!-- Main Welcome Card -->
    <Card.Root class="border-0 shadow-2xl bg-white rounded-2xl overflow-hidden">
      <Card.Header class="text-center pt-8 pb-2 space-y-2">
        <Card.Title class="text-2xl font-bold tracking-tight text-gray-900">
          Welcome to Codenames
        </Card.Title>
      </Card.Header>

      <Card.Content class="space-y-6 px-8 pb-10">
        <div class="space-y-4">
          <div class="text-center text-gray-600">
            To enter the room, choose a nickname.
          </div>
          
          <Input 
            type="text" 
            bind:value={nickname} 
            placeholder="Enter your nickname" 
            class="h-12 text-center text-lg border-gray-300 rounded-full focus-visible:ring-offset-0 focus-visible:ring-yellow-400 focus-visible:border-yellow-400"
          />
          
          <Button 
            onclick={handleCreateRoom}
            disabled={!nickname.trim()}
            class="w-full h-12 text-lg font-bold bg-[#FFD700] hover:bg-[#FFC000] text-black rounded-full shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Create Room
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
                    class="h-10 text-center uppercase tracking-widest border-gray-300 rounded-lg"
                  />
                 <Button 
                    onclick={handleJoinRoom}
                    disabled={!nickname.trim() || !roomCode.trim()}
                    variant="secondary"
                    class="h-10 px-6 font-bold"
                 >
                    Join
                 </Button>
             </div>
        </div>
        
        <!-- Custom Words Import -->
        <div class="pt-4 border-t border-gray-100 space-y-3">
            <Label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Word List (One per line)</Label>
            <Textarea 
              bind:value={customWords}
              placeholder="Enter custom words here..."
              rows={4}
              class="text-sm border-gray-200 resize-none"
            />
            <p class="text-xs text-gray-400">Minimum 25 words required for a game. Leave empty to use default words.</p>
        </div>

      </Card.Content>
    </Card.Root>

    <!-- Footer -->
    <div class="text-center text-white/80 text-sm">
        <p>Looking for a public game?</p>
        <button class="text-white underline hover:text-yellow-200">
            Open Room Explorer
        </button>
    </div>

  </div>
</div>
