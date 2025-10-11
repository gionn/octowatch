<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import RepositoryCard from '$lib/components/RepositoryCard.svelte';
	import RefreshButton from '$lib/components/RefreshButton.svelte';
	import { loadConfig, getCachedConfig } from '$lib/services/config-loader.js';
	import { GitHubApiClient } from '$lib/services/github-api.js';
	import type { Repository, WorkflowRun, Config } from '$lib/types/github.js';
	
	let repositoryStatuses: Array<{
		repository: Repository;
		workflowRuns: WorkflowRun[];
		error?: string;
	}> = [];
	let loading = true;
	let error = '';
	let lastUpdated: Date | null = null;
	let apiClient: GitHubApiClient;
	let config: Config | null = null;
	let autoRefreshInterval: number | null = null;
	let configWatchInterval: number | null = null;

	async function loadRepositories(forceReloadConfig = false) {
		try {
			loading = true;
			error = '';
			
			// Load config (fresh or from cache)
			if (forceReloadConfig || !config) {
				config = await loadConfig();
				setupAutoRefresh();
			} else {
				config = getCachedConfig() || await loadConfig();
			}
			
			apiClient = new GitHubApiClient(config.github.api_url, config.github.token);
			
			repositoryStatuses = await apiClient.getAllRepositoryStatuses(config.repositories);
			lastUpdated = new Date();
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load repositories';
			loading = false;
		}
	}

	function setupAutoRefresh() {
		// Clear existing interval
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
		}

		// Set up new auto-refresh based on config
		if (config?.dashboard?.refresh_interval && config.dashboard.refresh_interval > 0) {
			autoRefreshInterval = setInterval(() => {
				if (!loading) {
					loadRepositories(false); // Don't force config reload on auto-refresh
				}
			}, config.dashboard.refresh_interval * 1000);
		}
	}

	function setupConfigWatcher() {
		// Simple config watcher - checks every 5 seconds if config has changed
		if (typeof window !== 'undefined') {
			configWatchInterval = setInterval(async () => {
				try {
					const response = await fetch('/config.yaml?' + Date.now());
					if (response.ok) {
						const yamlContent = await response.text();
						const { loadConfigFromYaml } = await import('$lib/services/config-loader.js');
						const newConfig = await loadConfigFromYaml(yamlContent);
						
						// Simple comparison - reload if config appears different
						const currentConfigString = JSON.stringify(config);
						const newConfigString = JSON.stringify(newConfig);
						
						if (currentConfigString !== newConfigString) {
							console.log('🔄 Config file changed, reloading...');
							await loadRepositories(true);
						}
					}
				} catch (err) {
					// Silently fail - config watching is not critical
				}
			}, 5000); // Check every 5 seconds
		}
	}

	async function handleRefresh() {
		await loadRepositories(true); // Force config reload on manual refresh
	}

	onMount(() => {
		loadRepositories(true);
		setupConfigWatcher();
	});

	onDestroy(() => {
		if (autoRefreshInterval) {
			clearInterval(autoRefreshInterval);
		}
		if (configWatchInterval) {
			clearInterval(configWatchInterval);
		}
	});
</script>

<svelte:head>
	<title>GitHub Repository Monitoring Dashboard</title>
</svelte:head>

<div class="dashboard">
	<header>
		<h1>GitHub Actions Workflow Monitor</h1>
		<p>Monitor GitHub Actions workflows across multiple repositories</p>
	</header>

	<div class="controls">
		<RefreshButton 
			{loading} 
			{lastUpdated} 
			on:refresh={handleRefresh} 
		/>
		
		{#if config?.dashboard?.refresh_interval}
			<div class="auto-refresh-info">
				<span class="auto-refresh-indicator">🔄</span>
				Auto-refresh: {config.dashboard.refresh_interval}s
				{#if typeof window !== 'undefined'}
					<span class="dev-indicator">| Config watch: ON</span>
				{/if}
			</div>
		{/if}
	</div>

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

	.controls {
		margin-bottom: 1rem;
	}

	.auto-refresh-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: #e3f2fd;
		border: 1px solid #bbdefb;
		border-radius: 6px;
		font-size: 0.85rem;
		color: #1565c0;
	}

	.auto-refresh-indicator {
		animation: spin 2s linear infinite;
	}

	.dev-indicator {
		color: #ff9800;
		font-weight: 500;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.repositories {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
		
		.auto-refresh-info {
			flex-direction: column;
			text-align: center;
			gap: 0.25rem;
		}
	}
</style>