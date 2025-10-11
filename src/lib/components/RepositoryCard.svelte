<script lang="ts">
	import type { Repository, WorkflowRun } from '../types/github.js';
	import { getWorkflowStatus } from '../services/github-api.js';
	import { formatDate } from '../utils/date-formatter.js';

	export let repository: Repository;
	export let workflowRuns: WorkflowRun[] = [];
	export let error: string | undefined = undefined;

	$: workflowStatus = getWorkflowStatus(workflowRuns);
	$: lastRun = workflowStatus.lastRun;
</script>

<div class="repo-card" class:success={workflowStatus.status === 'success'} 
     class:failure={workflowStatus.status === 'failure'}
     class:in-progress={workflowStatus.status === 'in_progress'}
     class:cancelled={workflowStatus.status === 'cancelled'}
     class:error-state={error}>
	
	<div class="repo-header">
		<h3>
			<a href={repository.url} target="_blank" rel="noopener noreferrer">
				{repository.owner}/{repository.name}
			</a>
		</h3>
		{#if error}
			<div class="error-badge">Error</div>
		{:else}
			<div class="status-badge" class:success={workflowStatus.status === 'success'} 
			     class:failure={workflowStatus.status === 'failure'}
			     class:in-progress={workflowStatus.status === 'in_progress'}
			     class:cancelled={workflowStatus.status === 'cancelled'}
			     class:unknown={workflowStatus.status === 'unknown'}>
				{workflowStatus.status.toUpperCase().replace('_', ' ')}
			</div>
		{/if}
	</div>

	{#if error}
		<div class="error-message">
			{error}
		</div>
	{:else}
		<div class="repo-details">
			<div class="detail-row">
				<span class="label">Branch:</span>
				<span class="value">{repository.branch}</span>
			</div>
			
			{#if lastRun}
				<div class="detail-row">
					<span class="label">Last Run:</span>
					<span class="value">{formatDate(lastRun.updated_at)}</span>
				</div>
				
				{#if lastRun.name}
					<div class="detail-row">
						<span class="label">Workflow:</span>
						<span class="value">{lastRun.name}</span>
					</div>
				{/if}
				
				<div class="detail-row">
					<span class="label">Commit:</span>
					<span class="value commit-sha">{lastRun.head_sha.substring(0, 7)}</span>
				</div>
				
				<div class="actions">
					<a href={lastRun.html_url} target="_blank" rel="noopener noreferrer" class="view-link">
						View Run →
					</a>
				</div>
			{:else}
				<div class="no-runs">
					No workflow runs found
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.repo-card {
		background: white;
		border: 1px solid #e1e4e8;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.repo-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.repo-card.success {
		border-left: 4px solid #28a745;
	}

	.repo-card.failure {
		border-left: 4px solid #d73a49;
	}

	.repo-card.in-progress {
		border-left: 4px solid #ffc107;
	}

	.repo-card.cancelled {
		border-left: 4px solid #6c757d;
	}

	.repo-card.error-state {
		border-left: 4px solid #dc3545;
		background-color: #fff5f5;
	}

	.repo-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.repo-header h3 {
		margin: 0;
		color: #24292e;
		font-size: 1.1rem;
		flex-grow: 1;
	}

	.repo-header h3 a {
		color: inherit;
		text-decoration: none;
	}

	.repo-header h3 a:hover {
		color: #0366d6;
		text-decoration: underline;
	}

	.status-badge, .error-badge {
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

	.error-badge {
		background-color: #f8d7da;
		color: #721c24;
	}

	.repo-details {
		color: #586069;
		font-size: 0.9rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.label {
		font-weight: 500;
		color: #24292e;
	}

	.value {
		color: #586069;
	}

	.commit-sha {
		font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		background-color: #f6f8fa;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.8rem;
	}

	.actions {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e1e4e8;
	}

	.view-link {
		color: #0366d6;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.view-link:hover {
		text-decoration: underline;
	}

	.error-message {
		color: #d73a49;
		font-size: 0.9rem;
		margin-top: 0.5rem;
		padding: 0.75rem;
		background-color: #ffeef0;
		border-radius: 4px;
		border: 1px solid #fdaeb7;
	}

	.no-runs {
		color: #6c757d;
		font-style: italic;
		text-align: center;
		padding: 1rem 0;
	}
</style>