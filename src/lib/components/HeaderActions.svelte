<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { TokenStorage } from '$lib/services/token-storage.js';

	export let loading = false;
	export let refreshTitle = 'Refresh';
	export let showRefresh = true;
	export let showSettings = true;

	const dispatch = createEventDispatcher();

	// Token settings popup state
	let showTokenPopup = false;
	let tokenInput = '';
	let tokenStatus = '';
	let hasToken = false;
	let ignoreDependabot = false;

	// Initialize token status
	$: hasToken = !!TokenStorage.getToken();

	function handleRefresh() {
		dispatch('refresh');
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
		} else {
			tokenStatus = 'Invalid token format. Please check your GitHub token.';
			return;
		}

		// Dispatch event to parent components
		dispatch('tokenUpdated');

		// Auto-close after successful save
		setTimeout(() => {
			if (tokenStatus === 'Settings saved successfully') {
				closeTokenPopup();
			}
		}, 1500);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeTokenPopup();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="header-actions">
	{#if showRefresh}
		<button class="action-btn refresh-btn" on:click={handleRefresh} disabled={loading} title={loading ? 'Loading...' : refreshTitle}>
			<svg class="refresh-icon" viewBox="0 0 24 24" fill="currentColor">
				<path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
			</svg>
		</button>
	{/if}
	{#if showSettings}
		<button class="action-btn settings-btn" on:click={openTokenPopup} title="Settings">
			<svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor">
				<path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.5,12.65 19.5,12.32 19.5,12C19.5,11.68 19.5,11.35 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.65 15.48,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.52,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.5,11.35 4.5,11.68 4.5,12C4.5,12.32 4.5,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.52,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.48,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
			</svg>
			<span class="token-indicator" class:has-token={hasToken}></span>
		</button>
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
		aria-labelledby="token-popup-title"
		aria-modal="true"
	>
		<div class="popup-content" on:click|stopPropagation>
			<div class="popup-header">
				<h3 id="token-popup-title">Settings</h3>
				<button class="close-btn" on:click={closeTokenPopup} aria-label="Close">×</button>
			</div>
			<div class="popup-body">
				<div class="form-group">
					<label for="token-input">GitHub Personal Access Token (optional)</label>
					<input
						id="token-input"
						type="password"
						bind:value={tokenInput}
						placeholder="ghp_... or github_pat_..."
						autocomplete="off"
					/>
					<p class="help-text">
						Add a GitHub token to increase API rate limits and access private repositories.
						Supports classic tokens (ghp_) and fine-grained tokens (github_pat_).
						For fine-grained tokens, ensure "Actions" read-only access is granted.
						Leave empty to use unauthenticated requests with lower rate limits.
					</p>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input
							type="checkbox"
							bind:checked={ignoreDependabot}
						/>
						Ignore Dependabot workflows
					</label>
					<p class="help-text">
						Hide workflows created by Dependabot from the dashboard.
					</p>
				</div>

				{#if tokenStatus}
					<div class="status-message" class:error={tokenStatus.includes('Invalid')}>
						{tokenStatus}
					</div>
				{/if}

				<div class="popup-actions">
					<button class="cancel-btn" on:click={closeTokenPopup}>Cancel</button>
					<button class="save-btn" on:click={saveToken}>Save Settings</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
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

	/* Popup Styles */
	.popup-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.popup-content {
		background: white;
		border-radius: 8px;
		width: 100%;
		max-width: 500px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
	}

	.popup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 1.5rem 0 1.5rem;
		border-bottom: 1px solid #e1e4e8;
		margin-bottom: 1.5rem;
	}

	.popup-header h3 {
		margin: 0;
		color: #333;
		font-size: 1.25rem;
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
		background-color: #f6f8fa;
		color: #d73a49;
	}

	.popup-body {
		padding: 0 1.5rem 1.5rem 1.5rem;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #333;
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		cursor: pointer;
	}

	.checkbox-label input[type="checkbox"] {
		margin: 0;
	}

	input[type="password"] {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #e1e4e8;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	input[type="password"]:focus {
		outline: none;
		border-color: #007cba;
	}

	.help-text {
		font-size: 0.875rem;
		color: #666;
		margin: 0.5rem 0 0 0;
		line-height: 1.4;
	}

	.status-message {
		padding: 0.75rem;
		border-radius: 6px;
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
		margin-bottom: 1rem;
	}

	.status-message.error {
		background-color: #f8d7da;
		color: #721c24;
		border-color: #f5c6cb;
	}

	.popup-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.cancel-btn, .save-btn {
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
		transition: all 0.2s ease;
	}

	.cancel-btn {
		background: #f6f8fa;
		color: #333;
		border: 1px solid #e1e4e8;
	}

	.cancel-btn:hover {
		background: #e1e4e8;
	}

	.save-btn {
		background: #007cba;
		color: white;
		border: 1px solid #007cba;
	}

	.save-btn:hover {
		background: #005a8b;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.popup-overlay {
			padding: 0.5rem;
		}

		.popup-header {
			padding: 1rem 1rem 0 1rem;
		}

		.popup-body {
			padding: 0 1rem 1rem 1rem;
		}

		.popup-actions {
			flex-direction: column;
		}
	}
</style>
