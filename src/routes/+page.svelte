<script lang="ts">
	import { onMount } from 'svelte';
	import RepositoryCard from '$lib/components/RepositoryCard.svelte';
	import RefreshButton from '$lib/components/RefreshButton.svelte';
	import { loadConfig } from '$lib/services/config-loader.js';
	import { GitHubApiClient } from '$lib/services/github-api.js';
	import type { Repository, WorkflowRun } from '$lib/types/github.js';
	
	let repositoryStatuses: Array<{
		repository: Repository;
		workflowRuns: WorkflowRun[];
		error?: string;
	}> = [];
	let loading = true;
	let error = '';
	let lastUpdated: Date | null = null;
	let apiClient: GitHubApiClient;

	async function loadRepositories() {
		try {
			loading = true;
			error = '';
			
			const config = await loadConfig();
			apiClient = new GitHubApiClient(config.github.api_url, config.github.token);
			
			repositoryStatuses = await apiClient.getAllRepositoryStatuses(config.repositories);
			lastUpdated = new Date();
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load repositories';
			loading = false;
		}
	}

	async function handleRefresh() {
		await loadRepositories();
	}

	onMount(loadRepositories);
</script>

<svelte:head>
	<title>GitHub Repository Monitoring Dashboard</title>
</svelte:head>

<div class="dashboard">
	<header>
		<h1>GitHub Actions Workflow Monitor</h1>
		<p>Monitor GitHub Actions workflows across multiple repositories</p>
	</header>

	<RefreshButton 
		{loading} 
		{lastUpdated} 
		on:refresh={handleRefresh} 
	/>

	{#if loading && repositoryStatuses.length === 0}
		<div class="loading">Loading repositories...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if repositoryStatuses.length === 0}
		<div class="empty-state">
			<h3>No repositories configured</h3>
			<p>Add repositories to monitor in your <code>config.yaml</code> file.</p>
		</div>
	{:else}
		<div class="repositories">
			{#each repositoryStatuses as repoStatus}
				<RepositoryCard 
					repository={repoStatus.repository}
					workflowRuns={repoStatus.workflowRuns}
					error={repoStatus.error}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.dashboard {
		min-height: 100vh;
	}

	header {
		text-align: center;
		margin-bottom: 2rem;
	}

	header h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	header p {
		color: #666;
		font-size: 1.1rem;
	}

	.loading, .error, .empty-state {
		text-align: center;
		padding: 2rem;
		font-size: 1.1rem;
	}

	.error {
		color: #d73a49;
		background-color: #ffeef0;
		border: 1px solid #fdaeb7;
		border-radius: 6px;
	}

	.empty-state {
		color: #6c757d;
		background-color: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 8px;
	}

	.empty-state h3 {
		margin-bottom: 0.5rem;
		color: #495057;
	}

	.empty-state code {
		background-color: #e9ecef;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
	}

	.repositories {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.repositories {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}
</style>