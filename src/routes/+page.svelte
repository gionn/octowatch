<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import RefreshButton from '$lib/components/RefreshButton.svelte';
	import { loadConfig, getCachedConfig } from '$lib/services/config-loader.js';
	import { GitHubApiClient } from '$lib/services/github-api.js';
	import { formatDate } from '$lib/utils/date-formatter.js';
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

	// Track which repositories are expanded
	let expandedRepos = new Set<string>();

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
						    class:expanded={isExpanded}>

							<td class="expand-cell">
								{#if repoStatus.error}
									<span class="expand-icon error">❌</span>
								{:else if repoStatus.workflowRuns.length > 0}
									<button class="expand-button" on:click={() => toggleRepository(repoKey)}>
										<span class="expand-icon" class:expanded={isExpanded}>
											{isExpanded ? '▼' : '▶'}
										</span>
									</button>
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
											{#if run.status === 'in_progress' || run.status === 'queued'}
												IN PROGRESS
											{:else if run.status === 'completed'}
												{run.conclusion?.toUpperCase() || 'UNKNOWN'}
											{:else}
												{run.status.toUpperCase()}
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

	.table-container {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		border: 1px solid #e1e4e8;
	}

	.workflows-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.workflows-table th {
		background-color: #f6f8fa;
		color: #24292e;
		font-weight: 600;
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 2px solid #e1e4e8;
		white-space: nowrap;
	}

	.expand-col {
		width: 40px;
		text-align: center;
	}

	.workflows-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e1e4e8;
		vertical-align: middle;
	}

	/* Repository summary row styles */
	.repo-summary-row {
		background-color: #f8f9fa;
		font-weight: 500;
		cursor: pointer;
	}

	.repo-summary-row:hover {
		background-color: #e9ecef;
	}

	.repo-summary-row.success {
		border-left: 4px solid #28a745;
	}

	.repo-summary-row.failure {
		border-left: 4px solid #d73a49;
	}

	.repo-summary-row.in-progress {
		border-left: 4px solid #ffc107;
	}

	.repo-summary-row.cancelled {
		border-left: 4px solid #6c757d;
	}

	.repo-summary-row.error-row {
		border-left: 4px solid #dc3545;
	}

	/* Expand/collapse functionality */
	.expand-cell {
		text-align: center;
		width: 40px;
		padding: 0.5rem;
	}

	.expand-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.expand-button:hover {
		background-color: rgba(0, 0, 0, 0.1);
	}

	.expand-icon {
		font-size: 0.8rem;
		transition: transform 0.2s ease;
		color: #586069;
	}

	.expand-icon.expanded {
		transform: rotate(0deg);
	}

	.expand-icon.error {
		font-size: 1rem;
	}

	.expand-icon.empty {
		color: #d1d5da;
	}

	/* Workflow detail rows */
	.workflow-detail-row {
		background-color: #fafbfc;
		border-left: 4px solid #e1e4e8;
	}

	.workflow-detail-row:hover {
		background-color: #f1f3f4;
	}

	.workflow-detail-row.success {
		border-left: 4px solid #28a745;
	}

	.workflow-detail-row.failure {
		border-left: 4px solid #d73a49;
	}

	.workflow-detail-row.in-progress {
		border-left: 4px solid #ffc107;
	}

	.workflow-detail-row.cancelled {
		border-left: 4px solid #6c757d;
	}

	.workflow-indent {
		color: #586069;
		font-size: 0.9rem;
		padding-left: 1rem;
	}

	.workflow-name-cell {
		font-style: italic;
	}

	.workflow-id-cell {
		font-size: 0.8rem;
		color: #586069;
	}

	.expand-cell.detail {
		background-color: transparent;
	}

	.repo-cell, .branch-cell {
		background-color: #f8f9fa;
		font-weight: 500;
		color: #24292e;
	}

	.repo-link {
		color: #0366d6;
		text-decoration: none;
		font-weight: 500;
	}

	.repo-link:hover {
		text-decoration: underline;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: bold;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.status-badge.success {
		background-color: #dcffe4;
		color: #28a745;
	}

	.status-badge.failure {
		background-color: #ffeef0;
		color: #d73a49;
	}

	.status-badge.in-progress {
		background-color: #fff3cd;
		color: #856404;
	}

	.status-badge.cancelled {
		background-color: #f8f9fa;
		color: #6c757d;
	}

	.status-badge.unknown {
		background-color: #e9ecef;
		color: #495057;
	}

	.status-badge.error {
		background-color: #f8d7da;
		color: #721c24;
	}

	.status-badge.small {
		padding: 0.2rem 0.5rem;
		font-size: 0.7rem;
	}

	.commit-sha {
		font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		background-color: #f6f8fa;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-size: 0.8rem;
		color: #586069;
	}

	.view-link {
		color: #0366d6;
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	.view-link.small {
		font-size: 0.8rem;
	}

	.workflow-summary {
		color: #586069;
		font-size: 0.9rem;
	}

	.no-workflows {
		color: #a0a9b8;
		font-style: italic;
	}

	.workflows-cell {
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.error-cell, .no-workflows-cell {
		text-align: center;
		font-style: italic;
		color: #6c757d;
	}

	.error-message {
		color: #d73a49;
		font-weight: 500;
	}

	.no-workflows-message {
		color: #6c757d;
	}

	.time-cell {
		color: #586069;
		white-space: nowrap;
	}

	.workflow-cell {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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

		.auto-refresh-info {
			flex-direction: column;
			text-align: center;
			gap: 0.25rem;
		}

		.workflow-cell {
			max-width: 150px;
		}
	}
</style>
