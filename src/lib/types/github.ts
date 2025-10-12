export interface Repository {
	name: string;
	owner: string;
	url: string;
	branch: string;
	enabled: boolean;
}

export interface Config {
	repositories: Repository[];
	github: {
		api_url: string;
	};
	dashboard: {
		refresh_interval: number;
		max_runs_to_fetch: number;
		show_statuses: string[];
	};
}

export interface WorkflowRun {
	id: number;
	name: string;
	status: 'queued' | 'in_progress' | 'completed';
	conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null;
	created_at: string;
	updated_at: string;
	html_url: string;
	head_branch: string;
	head_sha: string;
	actor: {
		login: string;
	};
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
	};
	default_branch: string;
}
