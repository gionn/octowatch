<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { loadConfig, getRepositoryGroups } from '$lib/services/config-loader.js';
	import { TokenStorage } from '$lib/services/token-storage.js';
	import type { Config, RepositoryGroup } from '$lib/types/github.js';

	let groups: RepositoryGroup[] = [];
	let loading = true;
	let error = '';
	let config: Config | null = null;
	let configWatchInterval: number | null = null;

	// Token settings popup state
	let showTokenPopup = false;
	let tokenInput = '';
	let tokenStatus = '';
	let hasToken = false;
	let ignoreDependabot = false;



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
		loadTokenFromStorage();
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
	<title>GitHub Repository Monitoring Dashboard</title>
</svelte:head>

<div class="dashboard">
	<header>
		<div class="header-content">
			<div class="header-text">
				<h1>GitHub Repository Groups</h1>
				<p>Select a group to monitor GitHub Actions workflows</p>
			</div>
			<div class="header-actions">
				<button class="action-btn refresh-btn" on:click={handleRefresh} disabled={loading} title={loading ? 'Loading...' : 'Refresh Groups'}>
					<svg class="refresh-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
					</svg>
				</button>
				<button class="action-btn settings-btn" on:click={openTokenPopup} title="Settings">
					<svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.5,12.65 19.5,12.32 19.5,12C19.5,11.68 19.5,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.65 15.48,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.52,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.5,11.35 4.5,11.68 4.5,12C4.5,12.32 4.5,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.52,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.48,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
					</svg>
					<span class="token-indicator" class:has-token={hasToken}></span>
				</button>
			</div>
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

<!-- Token Settings Popup -->
{#if showTokenPopup}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="popup-overlay"
		on:click={closeTokenPopup}
		role="dialog"
		aria-modal="true"
		aria-label="Settings dialog"
	>
		<div class="popup-content" on:click|stopPropagation role="document">
			<div class="popup-header">
				<h3>Settings</h3>
				<button class="close-btn" on:click={closeTokenPopup}>&times;</button>
			</div>
			<div class="popup-body">
				<p>Enter your GitHub Personal Access Token to avoid rate limits and access private repositories.</p>
				<div class="form-group">
					<label for="token-input">GitHub Token:</label>
					<input
						type="password"
						id="token-input"
						bind:value={tokenInput}
						placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
						class="token-input"
					/>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={ignoreDependabot}
							class="checkbox-input"
						/>
						<span class="checkbox-text">Ignore Dependabot workflows</span>
					</label>
					<p class="form-help">Hide workflows triggered by Dependabot from the dashboard</p>
				</div>

				{#if tokenStatus}
					<div class="token-status" class:success={!tokenStatus.includes('Invalid')} class:error={tokenStatus.includes('Invalid')}>
						{tokenStatus}
					</div>
				{/if}
				<div class="form-actions">
					<button class="btn btn-primary" on:click={saveToken}>
						Save Settings
					</button>
					<button class="btn btn-secondary" on:click={closeTokenPopup}>Cancel</button>
				</div>
			</div>
			<div class="popup-footer">
				<p><small>
					<a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
						Create a new token on GitHub
					</a>
				</small></p>
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

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
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
		border-radius: 6px;
	}

	.action-btn:hover:not(:disabled) {
		color: #007cba;
		background-color: #f8f9fa;
		transform: scale(1.1);
	}

	.action-btn:disabled {
		color: #adb5bd;
		cursor: not-allowed;
	}

	.settings-btn:hover:not(:disabled) {
		transform: rotate(90deg) scale(1.1);
	}

	.refresh-btn:hover:not(:disabled) {
		transform: rotate(360deg) scale(1.1);
	}

	.gear-icon, .refresh-icon {
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

		.settings-btn {
			margin-top: 1rem;
		}
	}

	/* Popup Styles */
	.popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	.popup-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		max-width: 500px;
		width: 90%;
		max-height: 90vh;
		overflow-y: auto;
		animation: slideIn 0.2s ease;
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 1.5rem 1rem 1.5rem;
		border-bottom: 1px solid #eee;
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
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background-color 0.2s ease;
	}

	.close-btn:hover {
		background-color: #f5f5f5;
		color: #333;
	}

	.popup-body {
		padding: 1.5rem;
	}

	.popup-body p {
		margin-bottom: 1rem;
		color: #666;
		line-height: 1.5;
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

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		margin-bottom: 0.25rem !important;
	}

	.checkbox-input {
		width: auto;
		margin: 0;
		cursor: pointer;
	}

	.checkbox-text {
		color: #333;
		font-weight: 500;
	}

	.form-help {
		margin: 0.25rem 0 0 0;
		color: #666;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.token-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		transition: border-color 0.2s ease;
	}

	.token-input:focus {
		outline: none;
		border-color: #007cba;
	}

	.token-status {
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.token-status.success {
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.token-status.error {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: background-color 0.2s ease;
	}

	.btn-primary {
		background-color: #007cba;
		color: white;
	}

	.btn-primary:hover {
		background-color: #005a87;
	}

	.btn-secondary {
		background-color: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background-color: #545b62;
	}

	.popup-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #eee;
		background-color: #f8f9fa;
		border-radius: 0 0 8px 8px;
	}

	.popup-footer p {
		margin: 0;
		text-align: center;
	}

	.popup-footer a {
		color: #007cba;
		text-decoration: none;
	}

	.popup-footer a:hover {
		text-decoration: underline;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.popup-content {
			width: 95%;
			margin: 1rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>
