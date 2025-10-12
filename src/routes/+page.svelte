<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { loadConfig, getRepositoryGroups } from '$lib/services/config-loader.js';
	import { TokenStorage } from '$lib/services/token-storage.js';
	import HeaderActions from '$lib/components/HeaderActions.svelte';
	import type { Config, RepositoryGroup } from '$lib/types/github.js';

	let groups: RepositoryGroup[] = [];
	let loading = true;
	let error = '';
	let config: Config | null = null;
	let configWatchInterval: number | null = null;

	async function loadGroups() {
		try {
			loading = true;
			error = '';

			config = await loadConfig();
			groups = getRepositoryGroups(config);
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load configuration';
			loading = false;
		}
	}

	function setupConfigWatcher() {
		// Simple config watcher - checks every 5 seconds if config has changed
		if (typeof window !== 'undefined') {
			configWatchInterval = setInterval(async () => {
				try {
					const response = await fetch(`${base}/config.yaml?` + Date.now());
					if (response.ok) {
						const yamlContent = await response.text();
						const { loadConfigFromYaml } = await import('$lib/services/config-loader.js');
						const newConfig = await loadConfigFromYaml(yamlContent);

						// Simple comparison - reload if config appears different
						const currentConfigString = JSON.stringify(config);
						const newConfigString = JSON.stringify(newConfig);

						if (currentConfigString !== newConfigString) {
							console.log('🔄 Config file changed, reloading...');
							await loadGroups();
						}
					}
				} catch (err) {
					// Silently fail - config watching is not critical
				}
			}, 5000); // Check every 5 seconds
		}
	}

	async function handleRefresh() {
		await loadGroups(); // Force config reload on manual refresh
	}

	onMount(() => {
		loadGroups();
		setupConfigWatcher();
	});

	onDestroy(() => {
		if (configWatchInterval) {
			clearInterval(configWatchInterval);
		}
	});
</script>

<svelte:head>
	<title>OctoWatch</title>
</svelte:head>

<div class="dashboard">
	<header>
		<div class="header-content">
			<div class="header-text">
				<h1>GitHub Repository Groups</h1>
				<p>Select a group to monitor GitHub Actions workflows</p>
			</div>
			<HeaderActions
				{loading}
				refreshTitle="Refresh Groups"
				on:refresh={handleRefresh}
			/>
		</div>
	</header>

	{#if loading}
		<div class="loading">Loading groups...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if groups.length === 0}
		<div class="empty-state">
			<h3>No repository groups configured</h3>
			<p>Add repository groups to monitor in your <code>config.yaml</code> file.</p>
		</div>
	{:else}
		<div class="groups-container">
			<div class="groups-grid">
				{#each groups as group}
					<div class="group-card">
						<h3>{group.name}</h3>
						<p class="group-description">{group.description}</p>
						<div class="group-stats">
							<span class="repo-count">{group.repositories.filter(r => r.enabled).length} repositories</span>
						</div>
						<div class="group-actions">
							<a href="/groups/{group.slug}" class="monitor-link">
								Monitor Workflows →
							</a>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>



<style>
	.dashboard {
		min-height: 100vh;
	}

	header {
		margin-bottom: 2rem;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-text {
		text-align: center;
		flex: 1;
	}

	.header-text h1 {
		color: #333;
		margin-bottom: 0.5rem;
		margin: 0;
	}

	.header-text p {
		color: #666;
		font-size: 1.1rem;
		margin: 0.5rem 0 0 0;
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



	.groups-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	.groups-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.group-card {
		background: white;
		border: 1px solid #e9ecef;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		transition: all 0.2s ease;
	}

	.group-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
	}

	.group-card h3 {
		color: #333;
		margin: 0 0 0.75rem 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.group-description {
		color: #666;
		margin: 0 0 1rem 0;
		line-height: 1.5;
	}

	.group-stats {
		margin: 1rem 0;
		padding: 0.5rem 0;
		border-top: 1px solid #e9ecef;
	}

	.repo-count {
		color: #007cba;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.group-actions {
		margin-top: 1rem;
	}

	.monitor-link {
		display: inline-block;
		background: #007cba;
		color: white;
		text-decoration: none;
		padding: 0.75rem 1.25rem;
		border-radius: 6px;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.monitor-link:hover {
		background: #005a8b;
		transform: translateX(2px);
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.groups-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.header-content {
			flex-direction: column;
			text-align: center;
		}

	}
</style>
