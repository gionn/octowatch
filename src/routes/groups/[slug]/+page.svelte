<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import HeaderActions from '$lib/components/HeaderActions.svelte';
	import { loadConfig, getCachedConfig, getRepositoryGroupBySlug } from '$lib/services/config-loader.js';
	import { GitHubApiClient } from '$lib/services/github-api.js';
	import { TokenStorage } from '$lib/services/token-storage.js';
	import { formatDate } from '$lib/utils/date-formatter.js';
	import type { Repository, WorkflowRun, Config, RepositoryGroup } from '$lib/types/github.js';

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
	let currentGroup: RepositoryGroup | null = null;
	let autoRefreshInterval: number | null = null;
	let configWatchInterval: number | null = null;

	// Track which repositories are expanded
	let expandedRepos = new Set<string>();

	// Get the slug from the URL
	$: slug = $page.params.slug;

	function toggleRepository(repoKey: string) {
		if (expandedRepos.has(repoKey)) {
			expandedRepos.delete(repoKey);
		} else {
			expandedRepos.add(repoKey);
		}
		expandedRepos = expandedRepos; // Trigger reactivity
	}

	function getRepositoryKey(repo: Repository): string {
		return `${repo.owner}/${repo.name}`;
	}



	function getCumulativeStatus(workflowRuns: WorkflowRun[]): {
		status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
		statusText: string;
		runCount: number;
	} {
		if (workflowRuns.length === 0) {
			return { status: 'unknown', statusText: 'No workflows', runCount: 0 };
		}

		// Count different statuses
		let successCount = 0;
		let failureCount = 0;
		let inProgressCount = 0;
		let cancelledCount = 0;

		for (const run of workflowRuns) {
			if (run.status === 'in_progress' || run.status === 'queued') {
				inProgressCount++;
			} else if (run.status === 'completed') {
				switch (run.conclusion) {
					case 'success':
						successCount++;
						break;
					case 'failure':
						failureCount++;
						break;
					case 'cancelled':
						cancelledCount++;
						break;
				}
			}
		}

		// Determine cumulative status (failure takes precedence)
		let status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
		let statusText: string;

		if (failureCount > 0) {
			status = 'failure';
			statusText = `${failureCount} failed, ${successCount} passed`;
		} else if (inProgressCount > 0) {
			status = 'in_progress';
			statusText = `${inProgressCount} running, ${successCount} passed`;
		} else if (successCount > 0) {
			status = 'success';
			statusText = `${successCount} passed`;
		} else if (cancelledCount > 0) {
			status = 'cancelled';
			statusText = `${cancelledCount} cancelled`;
		} else {
			status = 'unknown';
			statusText = 'Unknown status';
		}

		return { status, statusText, runCount: workflowRuns.length };
	}

	async function loadRepositories(forceReloadConfig = false) {
		try {
			loading = true;
			error = '';

			// Get the slug from the page params
			const slug = $page.params.slug;
			if (!slug) {
				error = 'No group specified';
				loading = false;
				return;
			}

			// Load config (fresh or from cache)
			if (forceReloadConfig || !config) {
				config = await loadConfig();
				setupAutoRefresh();
			} else {
				config = getCachedConfig() || await loadConfig();
			}

			// Get the specific group
			currentGroup = getRepositoryGroupBySlug(config, slug);
			if (!currentGroup) {
				error = `Repository group "${slug}" not found`;
				loading = false;
				return;
			}

			// Get token from localStorage instead of config
			const token = TokenStorage.getToken();
			apiClient = new GitHubApiClient(config.github.api_url, token || undefined);

			repositoryStatuses = await apiClient.getAllRepositoryStatuses(
				currentGroup.repositories,
				config.dashboard.max_runs_to_fetch,
				TokenStorage.getIgnoreDependabot()
			);
			lastUpdated = new Date();
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load repositories';
			loading = false;
		}
	}

	function handleTokenUpdated() {
		// Update the API client with the new token when token is updated
		if (apiClient && config) {
			const token = TokenStorage.getToken();
			apiClient.updateToken(token || undefined);
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
	<title>{currentGroup?.name || 'Repository Group'} - OctoWatch</title>
</svelte:head>

<div class="dashboard">
	<header>
		<div class="header-content">
			<div class="header-text">
				<div class="breadcrumb">
					<a href="/">Repository Groups</a> / {currentGroup?.name || slug}
				</div>
				<h1>{currentGroup?.name || 'Repository Group'}</h1>
				<p>{currentGroup?.description || 'Monitor GitHub Actions workflows for this group'}</p>
			</div>
			<HeaderActions
				{loading}
				refreshTitle="Refresh Repositories"
				on:refresh={handleRefresh}
				on:tokenUpdated={handleTokenUpdated}
			/>
		</div>
	</header>

	{#if loading && repositoryStatuses.length === 0}
		<div class="loading">Loading repositories...</div>
	{:else if error}
		<div class="error">{error}</div>
	{:else if repositoryStatuses.length === 0}
		<div class="empty-state">
			<h3>No repositories configured</h3>
			<p>Add repositories to monitor in your <code>config.yaml</code> file for the "{slug}" group.</p>
		</div>
	{:else}
		<div class="table-container">
			<table class="workflows-table">
				<thead>
					<tr>
						<th class="expand-col"></th>
						<th>Repository</th>
						<th>Branch</th>
						<th>Status</th>
						<th>Workflows</th>
						<th>Last Activity</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each repositoryStatuses as repoStatus}
						{@const repoKey = getRepositoryKey(repoStatus.repository)}
						{@const isExpanded = expandedRepos.has(repoKey)}
						{@const cumulativeStatus = repoStatus.error ? null : getCumulativeStatus(repoStatus.workflowRuns)}

						<!-- Repository summary row -->
						<tr class="repo-summary-row"
						    class:success={cumulativeStatus?.status === 'success'}
						    class:failure={cumulativeStatus?.status === 'failure'}
						    class:in-progress={cumulativeStatus?.status === 'in_progress'}
						    class:cancelled={cumulativeStatus?.status === 'cancelled'}
						    class:error-row={repoStatus.error}
						    class:expanded={isExpanded}
						    class:clickable={!repoStatus.error && repoStatus.workflowRuns.length > 0}
						    on:click={() => !repoStatus.error && repoStatus.workflowRuns.length > 0 && toggleRepository(repoKey)}
						    on:keydown={(e) => {
						    	if ((e.key === 'Enter' || e.key === ' ') && !repoStatus.error && repoStatus.workflowRuns.length > 0) {
						    		e.preventDefault();
						    		toggleRepository(repoKey);
						    	}
						    }}
						    tabindex={!repoStatus.error && repoStatus.workflowRuns.length > 0 ? 0 : -1}
						    role={!repoStatus.error && repoStatus.workflowRuns.length > 0 ? "button" : undefined}
						    aria-expanded={!repoStatus.error && repoStatus.workflowRuns.length > 0 ? isExpanded : undefined}>

							<td class="expand-cell">
								{#if repoStatus.error}
									<span class="expand-icon error">❌</span>
								{:else if repoStatus.workflowRuns.length > 0}
									<span class="expand-icon" class:expanded={isExpanded}>
										{isExpanded ? '▼' : '▶'}
									</span>
								{:else}
									<span class="expand-icon empty">○</span>
								{/if}
							</td>

							<td class="repo-cell">
								<a href={repoStatus.repository.url} target="_blank" rel="noopener noreferrer" class="repo-link">
									{repoStatus.repository.owner}/{repoStatus.repository.name}
								</a>
							</td>

							<td class="branch-cell">
								{repoStatus.repository.branch}
							</td>

							<td class="status-cell">
								{#if repoStatus.error}
									<span class="status-badge error">ERROR</span>
								{:else if cumulativeStatus}
									<span class="status-badge"
									      class:success={cumulativeStatus.status === 'success'}
									      class:failure={cumulativeStatus.status === 'failure'}
									      class:in-progress={cumulativeStatus.status === 'in_progress'}
									      class:cancelled={cumulativeStatus.status === 'cancelled'}
									      class:unknown={cumulativeStatus.status === 'unknown'}>
										{cumulativeStatus.status.toUpperCase().replace('_', ' ')}
									</span>
								{/if}
							</td>

							<td class="workflows-cell">
								{#if repoStatus.error}
									<span class="error-message">{repoStatus.error}</span>
								{:else if cumulativeStatus}
									<span class="workflow-summary">{cumulativeStatus.statusText}</span>
								{:else}
									<span class="no-workflows">No workflows</span>
								{/if}
							</td>

							<td class="time-cell">
								{#if repoStatus.workflowRuns.length > 0}
									{formatDate(repoStatus.workflowRuns[0].updated_at)}
								{:else}
									—
								{/if}
							</td>

							<td class="actions-cell">
								<a href={repoStatus.repository.url + '/actions'} target="_blank" rel="noopener noreferrer" class="view-link">
									View All →
								</a>
							</td>
						</tr>

						<!-- Expanded workflow details -->
						{#if isExpanded && !repoStatus.error && repoStatus.workflowRuns.length > 0}
							{#each repoStatus.workflowRuns as run}
								<tr class="workflow-detail-row"
								    class:success={run.status === 'completed' && run.conclusion === 'success'}
								    class:failure={run.status === 'completed' && run.conclusion === 'failure'}
								    class:in-progress={run.status === 'in_progress' || run.status === 'queued'}
								    class:cancelled={run.status === 'completed' && run.conclusion === 'cancelled'}>

									<td class="expand-cell detail"></td>
									<td class="workflow-name-cell">
										<span class="workflow-indent">↳ {run.name || 'Unknown Workflow'}</span>
									</td>
									<td class="branch-detail-cell">
										{run.head_branch}
									</td>
									<td class="status-cell">
										<span class="status-badge small"
										      class:success={run.status === 'completed' && run.conclusion === 'success'}
										      class:failure={run.status === 'completed' && run.conclusion === 'failure'}
										      class:in-progress={run.status === 'in_progress' || run.status === 'queued'}
										      class:cancelled={run.status === 'completed' && run.conclusion === 'cancelled'}
										      class:unknown={run.status === 'completed' && !run.conclusion}>
											{#if run.status === 'in_progress'}
												IN PROGRESS
											{:else if run.status === 'queued'}
												QUEUED
											{:else if run.status === 'completed'}
												{run.conclusion?.toUpperCase() || 'UNKNOWN'}
											{/if}
										</span>
									</td>
									<td class="workflow-id-cell">
										<span class="commit-sha">{run.head_sha.substring(0, 7)}</span>
									</td>
									<td class="time-cell">
										{formatDate(run.updated_at)}
									</td>
									<td class="actions-cell">
										<a href={run.html_url} target="_blank" rel="noopener noreferrer" class="view-link small">
											View →
										</a>
									</td>
								</tr>
							{/each}
						{/if}
					{/each}
				</tbody>
			</table>
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

	.breadcrumb {
		font-size: 0.9rem;
		color: #666;
		margin-bottom: 0.5rem;
	}

	.breadcrumb a {
		color: #007cba;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		text-decoration: underline;
	}

	.header-text h1 {
		color: #333;
		margin-bottom: 0.5rem;
		margin-top: 0;
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
	}

	.empty-state code {
		background-color: #e9ecef;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-size: 0.9rem;
	}



	.table-container {
		background: white;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		border: 1px solid #e9ecef;
	}

	.workflows-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.workflows-table th {
		background-color: #f8f9fa;
		color: #495057;
		font-weight: 600;
		padding: 1rem;
		text-align: left;
		border-bottom: 2px solid #e9ecef;
		white-space: nowrap;
	}

	.workflows-table td {
		padding: 1rem;
		border-bottom: 1px solid #f0f0f0;
		vertical-align: middle;
	}

	.expand-col {
		width: 40px;
	}

	.expand-cell {
		text-align: center;
		width: 40px;
	}

	.expand-icon {
		cursor: pointer;
		font-size: 0.8rem;
		color: #666;
		user-select: none;
		transition: transform 0.2s ease;
	}

	.expand-icon.expanded {
		transform: rotate(0deg);
	}

	.expand-icon.error {
		cursor: default;
	}

	.expand-icon.empty {
		color: #ccc;
		cursor: default;
	}

	.repo-summary-row {
		transition: all 0.1s ease;
		position: relative;
	}

	.repo-summary-row.clickable {
		cursor: pointer;
	}

	.repo-summary-row.clickable:hover {
		background-color: #f8f9fa;
	}

	.repo-summary-row.success {
		border-left: 4px solid #28a745;
	}

	.repo-summary-row.failure {
		border-left: 4px solid #dc3545;
	}

	.repo-summary-row.in-progress {
		border-left: 4px solid #007bff;
	}

	.repo-summary-row.cancelled {
		border-left: 4px solid #6c757d;
	}

	.repo-summary-row.error-row {
		border-left: 4px solid #ffc107;
		background-color: #fff9e6;
	}

	.repo-link {
		color: #007cba;
		text-decoration: none;
		font-weight: 500;
	}

	.repo-link:hover {
		text-decoration: underline;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.status-badge.success {
		background-color: #d4edda;
		color: #155724;
	}

	.status-badge.failure {
		background-color: #f8d7da;
		color: #721c24;
	}

	.status-badge.in-progress {
		background-color: #cce5ff;
		color: #004085;
	}

	.status-badge.cancelled {
		background-color: #e2e3e5;
		color: #383d41;
	}

	.status-badge.unknown {
		background-color: #f8f9fa;
		color: #6c757d;
	}

	.status-badge.error {
		background-color: #fff3cd;
		color: #856404;
	}

	.status-badge.small {
		font-size: 0.65rem;
		padding: 0.2rem 0.4rem;
	}

	.workflow-summary {
		color: #666;
		font-size: 0.85rem;
	}

	.error-message {
		color: #d73a49;
		font-size: 0.85rem;
		font-style: italic;
	}

	.no-workflows {
		color: #999;
		font-style: italic;
		font-size: 0.85rem;
	}

	.time-cell {
		color: #666;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.view-link {
		color: #007cba;
		text-decoration: none;
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	.view-link.small {
		font-size: 0.8rem;
	}

	.workflow-detail-row {
		background-color: #f8f9fa;
		font-size: 0.85rem;
	}

	.workflow-detail-row.success {
		border-left: 4px solid #28a745;
	}

	.workflow-detail-row.failure {
		border-left: 4px solid #dc3545;
	}

	.workflow-detail-row.in-progress {
		border-left: 4px solid #007bff;
	}

	.workflow-detail-row.cancelled {
		border-left: 4px solid #6c757d;
	}

	.workflow-indent {
		margin-left: 1rem;
		color: #666;
	}

	.commit-sha {
		font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
		background-color: #f1f3f4;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.8rem;
		color: #24292f;
	}

	.expand-cell.detail {
		background-color: transparent;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@media (max-width: 1024px) {
		.table-container {
			overflow-x: auto;
		}

		.workflows-table {
			min-width: 800px;
		}
	}

	@media (max-width: 768px) {
		.workflows-table th,
		.workflows-table td {
			padding: 0.5rem;
		}

		.workflows-table {
			font-size: 0.8rem;
		}
	}
</style>
