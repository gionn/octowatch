import type { WorkflowRun, GitHubRepository, Repository } from '../types/github.js';

export class GitHubApiClient {
	private apiUrl: string;
	private token?: string;

	constructor(apiUrl: string = 'https://api.github.com', token?: string) {
		this.apiUrl = apiUrl;
		this.token = token;
	}

	private getHeaders(): HeadersInit {
		const headers: HeadersInit = {
			'Accept': 'application/vnd.github.v3+json',
			'Content-Type': 'application/json'
		};

		if (this.token) {
			headers['Authorization'] = `token ${this.token}`;
		}

		return headers;
	}

	private async makeRequest<T>(endpoint: string): Promise<T> {
		const url = `${this.apiUrl}${endpoint}`;

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: this.getHeaders()
			});

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Repository not found: ${endpoint}`);
				} else if (response.status === 403) {
					throw new Error('GitHub API rate limit exceeded. Consider using a personal access token.');
				} else if (response.status === 401) {
					throw new Error('GitHub API authentication failed. Check your access token.');
				} else {
					throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
				}
			}

			return await response.json();
		} catch (error) {
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(`Network error: ${error}`);
		}
	}

	async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
		return this.makeRequest<GitHubRepository>(`/repos/${owner}/${repo}`);
	}

	async getWorkflowRuns(owner: string, repo: string, branch?: string, limit: number = 5): Promise<WorkflowRun[]> {
		let endpoint = `/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;

		if (branch) {
			endpoint += `&branch=${encodeURIComponent(branch)}`;
		}

		const response = await this.makeRequest<{ workflow_runs: WorkflowRun[] }>(endpoint);
		return response.workflow_runs;
	}

	async getRepositoryStatus(repository: Repository): Promise<{
		repository: Repository;
		workflowRuns: WorkflowRun[];
		error?: string;
	}> {
		try {
			const workflowRuns = await this.getWorkflowRuns(
				repository.owner,
				repository.name,
				repository.branch,
				5
			);

			return {
				repository,
				workflowRuns
			};
		} catch (error) {
			return {
				repository,
				workflowRuns: [],
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			};
		}
	}

	async getAllRepositoryStatuses(repositories: Repository[]): Promise<Array<{
		repository: Repository;
		workflowRuns: WorkflowRun[];
		error?: string;
	}>> {
		const enabledRepositories = repositories.filter(repo => repo.enabled);

		// Process repositories in parallel, but with some throttling
		const promises = enabledRepositories.map(repo => this.getRepositoryStatus(repo));

		return Promise.all(promises);
	}
}

export function getWorkflowStatus(workflowRuns: WorkflowRun[]): {
	status: 'success' | 'failure' | 'in_progress' | 'cancelled' | 'unknown';
	lastRun?: WorkflowRun;
} {
	if (workflowRuns.length === 0) {
		return { status: 'unknown' };
	}

	// Get the most recent workflow run
	const lastRun = workflowRuns[0];

	if (lastRun.status === 'in_progress' || lastRun.status === 'queued') {
		return { status: 'in_progress', lastRun };
	}

	if (lastRun.status === 'completed') {
		switch (lastRun.conclusion) {
			case 'success':
				return { status: 'success', lastRun };
			case 'failure':
				return { status: 'failure', lastRun };
			case 'cancelled':
				return { status: 'cancelled', lastRun };
			default:
				return { status: 'unknown', lastRun };
		}
	}

	return { status: 'unknown', lastRun };
}
