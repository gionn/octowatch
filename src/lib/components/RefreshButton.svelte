<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let loading = false;
	export let lastUpdated: Date | null = null;

	const dispatch = createEventDispatcher();

	function handleRefresh() {
		dispatch('refresh');
	}

	$: lastUpdatedText = lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : '';
</script>

<div class="refresh-container">
	<button 
		class="refresh-button" 
		on:click={handleRefresh} 
		disabled={loading}
		title="Refresh all repositories"
	>
		<span class="refresh-icon" class:spinning={loading}>↻</span>
		{loading ? 'Refreshing...' : 'Refresh'}
	</button>
	
	{#if lastUpdatedText}
		<span class="last-updated">{lastUpdatedText}</span>
	{/if}
</div>

<style>
	.refresh-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.5rem;
		justify-content: center;
	}

	.refresh-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: #0366d6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: background-color 0.2s ease;
	}

	.refresh-button:hover:not(:disabled) {
		background-color: #0256cc;
	}

	.refresh-button:disabled {
		background-color: #94a3b8;
		cursor: not-allowed;
	}

	.refresh-icon {
		font-size: 1.2rem;
		transition: transform 0.3s ease;
	}

	.refresh-icon.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.last-updated {
		color: #6c757d;
		font-size: 0.8rem;
	}

	@media (max-width: 768px) {
		.refresh-container {
			flex-direction: column;
			gap: 0.5rem;
		}
	}
</style>