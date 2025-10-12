<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import RefreshButton from '$lib/components/RefreshButton.svelte';
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

	// Token settings popup state
	let showTokenPopup = false;
	let tokenInput = '';
	let tokenStatus = '';
	let hasToken = false;
	let ignoreDependabot = false;

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

	function openTokenPopup() {
		tokenInput = TokenStorage.getToken() || '';
		ignoreDependabot = TokenStorage.getIgnoreDependabot();
		tokenStatus = '';
		showTokenPopup = true;
	}

	function closeTokenPopup() {
		showTokenPopup = false;
		tokenInput = '';
		tokenStatus = '';
	}

	function saveToken() {
		// Save Dependabot setting
		TokenStorage.setIgnoreDependabot(ignoreDependabot);

		if (!tokenInput.trim()) {
			TokenStorage.removeToken();
			hasToken = false;
			tokenStatus = 'Settings saved successfully';
		} else if (TokenStorage.isValidTokenFormat(tokenInput)) {
			TokenStorage.setToken(tokenInput);
			hasToken = true;
			tokenStatus = 'Settings saved successfully';

			// Update the API client with the new token
			if (apiClient) {
				apiClient.updateToken(tokenInput.trim());
			}
		} else {
			tokenStatus = 'Invalid token format. Please check your GitHub token.';
			return;
		}

		// Auto-close popup after successful save
		if (!tokenStatus.includes('Invalid')) {
			setTimeout(() => {
				closeTokenPopup();
			}, 1500);
		}
	}

	function loadTokenFromStorage() {
		hasToken = TokenStorage.hasToken();
		ignoreDependabot = TokenStorage.getIgnoreDependabot();
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
		loadTokenFromStorage();
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
	<title>{currentGroup?.name || 'Repository Group'} - GitHub Repository Monitoring</title>
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
			<div class="header-actions">
				<button class="settings-btn" on:click={openTokenPopup} title="Settings">
					<svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.5,12.65 19.5,12.32 19.5,12C19.5,11.68 19.5,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.65 15.48,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.52,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.5,11.35 4.5,11.68 4.5,12C4.5,12.32 4.5,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.52,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.48,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
					</svg>
					<span class="token-indicator" class:has-token={hasToken}></span>
				</button>
			</div>
		</div>
	</header>

	<div class="controls">
		<RefreshButton
			{loading}
			{lastUpdated}
			on:refresh={handleRefresh}
		/>
	</div>

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

<!-- Token Settings Popup -->
{#if showTokenPopup}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="popup-overlay"
		on:click={closeTokenPopup}
		on:keydown={(e) => e.key === 'Escape' && closeTokenPopup()}
	>
		<div class="popup-content" on:click|stopPropagation>
			<div class="popup-header">
				<h3>Settings</h3>
				<button class="close-btn" on:click={closeTokenPopup}>×</button>
			</div>

			<div class="popup-body">
				<div class="form-group">
					<label for="github-token">GitHub Personal Access Token (optional)</label>
					<input
						id="github-token"
						type="password"
						bind:value={tokenInput}
						placeholder="Enter your GitHub token for higher API rate limits"
					/>
					<small>
						Tokens starting with 'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', or 'github_pat_' are supported.
						<br>
						Leave empty to use anonymous access (lower rate limits).
					</small>
				</div>

				<div class="form-group">
					<label>
						<input type="checkbox" bind:checked={ignoreDependabot} />
						Ignore Dependabot workflows
					</label>
					<small>
						Hide workflow runs initiated by Dependabot to reduce noise.
					</small>
				</div>

				{#if tokenStatus}
					<div class="status-message" class:error={tokenStatus.includes('Invalid')}>
						{tokenStatus}
					</div>
				{/if}
			</div>

			<div class="popup-footer">
				<button class="cancel-btn" on:click={closeTokenPopup}>Cancel</button>
				<button class="save-btn" on:click={saveToken}>Save Settings</button>
			</div>
		</div>
	</div>
{/if}

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

	.header-actions {
		display: flex;
		align-items: center;
	}

	.settings-btn {
		position: relative;
		background: none;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		color: #666;
		padding: 8px;
	}

	.settings-btn:hover {
		color: #007cba;
		transform: rotate(90deg) scale(1.1);
	}

	.gear-icon {
		width: 32px;
		height: 32px;
	}

	.token-indicator {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: #dc3545;
		border: 2px solid white;
	}

	.token-indicator.has-token {
		background-color: #28a745;
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

	.controls {
		margin-bottom: 1rem;
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

	/* Popup Styles */
	.popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.popup-content {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid #e9ecef;
	}

	.popup-header h3 {
		margin: 0;
		color: #333;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #666;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-btn:hover {
		background-color: #f8f9fa;
		color: #333;
	}

	.popup-body {
		padding: 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	.form-group input[type="password"] {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.form-group input[type="password"]:focus {
		outline: none;
		border-color: #007cba;
		box-shadow: 0 0 0 2px rgba(0, 124, 186, 0.2);
	}

	.form-group input[type="checkbox"] {
		margin-right: 0.5rem;
	}

	.form-group small {
		color: #666;
		font-size: 0.85rem;
		line-height: 1.4;
		display: block;
		margin-top: 0.5rem;
	}

	.status-message {
		padding: 0.75rem;
		border-radius: 4px;
		font-size: 0.9rem;
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.status-message.error {
		background-color: #f8d7da;
		color: #721c24;
		border-color: #f5c6cb;
	}

	.popup-footer {
		padding: 1.5rem;
		border-top: 1px solid #e9ecef;
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	.cancel-btn, .save-btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background-color: #6c757d;
		color: white;
	}

	.cancel-btn:hover {
		background-color: #5a6268;
	}

	.save-btn {
		background-color: #007cba;
		color: white;
	}

	.save-btn:hover {
		background-color: #005a8b;
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

		.popup-content {
			width: 95%;
			margin: 1rem;
		}

		.popup-header,
		.popup-body,
		.popup-footer {
			padding: 1rem;
		}

		.popup-footer {
			flex-direction: column;
		}

		.cancel-btn, .save-btn {
			width: 100%;
		}
	}
</style>
