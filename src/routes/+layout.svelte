<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
    import { loadScenario, SCENARIOS } from '$lib/mocks/scenarios';

	let { children } = $props();

    let showDevTools = $state(false);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}

<div class="dev-tools">
    <button class="toggle" onclick={() => showDevTools = !showDevTools}>
        {showDevTools ? 'Hide Debug' : 'Debug'}
    </button>
    {#if showDevTools}
        <div class="panel">
            <h3>Scenarios</h3>
            <div class="buttons">
                {#each Object.keys(SCENARIOS) as name}
                    <button onclick={() => loadScenario(name)}>{name}</button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .dev-tools {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        z-index: 9999;
    }

    .toggle {
        background: rgba(0,0,0,0.5);
        color: white;
        border: 1px solid white;
        padding: 0.5rem;
        cursor: pointer;
        font-size: 0.8rem;
    }

    .panel {
        background: rgba(0,0,0,0.9);
        padding: 1rem;
        border-radius: 8px;
        margin-top: 0.5rem;
        border: 1px solid #444;
    }

    .buttons {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .panel button {
        background: #333;
        color: white;
        border: 1px solid #666;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        text-align: left;
    }

    .panel button:hover {
        background: #555;
    }
    
    h3 {
        color: white;
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
    }
</style>
