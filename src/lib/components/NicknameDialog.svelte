<script lang="ts">
  import { onMount } from 'svelte';
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";

  let { open = $bindable(true), onsubmit }: { open: boolean; onsubmit?: (name: string) => void } = $props();
  
  let nickname = $state('');

  onMount(() => {
    const saved = localStorage.getItem('codenames_nickname');
    if (saved) nickname = saved;
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (nickname.trim()) {
      localStorage.setItem('codenames_nickname', nickname.trim());
      onsubmit?.(nickname.trim());
      open = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[425px]" portalProps={{}}>
    <Dialog.Header class="">
      <Dialog.Title class="">Enter Nickname</Dialog.Title>
      <Dialog.Description class="">
        Choose a name to identify yourself in the game.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={handleSubmit} class="grid gap-4 py-4">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label for="name" class="text-right">Name</Label>
        <Input 
            type="text"
            id="name" 
            bind:value={nickname} 
            placeholder="Agent 007" 
            class="col-span-3" 
            maxlength={20}
        />
      </div>
      <Dialog.Footer class="">
        <Button type="submit" disabled={!nickname.trim()} class="">Join Game</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
