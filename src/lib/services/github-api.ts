import type {
  WorkflowRun,
  GitHubRepository,
  Repository,
} from "../types/github.js";

export class GitHubApiClient {
  private apiUrl: string;
  private token?: string;

  constructor(apiUrl: string = "https://api.github.com", token?: string) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  /**
   * Update the GitHub token for this client instance
   */
  updateToken(token?: string): void {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `token ${this.token}`;
    }

    return headers;
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository not found: ${endpoint}`);
        } else if (response.status === 403) {
          throw new Error(
            "GitHub API rate limit exceeded. Consider using a personal access token.",
          );
        } else if (response.status === 401) {
          throw new Error(
            "GitHub API authentication failed. Check your access token.",
          );
        } else {
          throw new Error(
            `GitHub API error: ${response.status} ${response.statusText}`,
          );
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

  async getWorkflowRuns(
    owner: string,
    repo: string,
    branch?: string,
    limit: number = 20,
  ): Promise<WorkflowRun[]> {
    let endpoint = `/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;

    if (branch) {
      endpoint += `&branch=${encodeURIComponent(branch)}`;
    }

    const response = await this.makeRequest<{ workflow_runs: WorkflowRun[] }>(
      endpoint,
    );
    return response.workflow_runs;
  }

  private deduplicateWorkflowRuns(
    workflowRuns: WorkflowRun[],
    ignoreDependabot: boolean = false,
  ): WorkflowRun[] {
    const workflowMap = new Map<string, WorkflowRun>();

    // Sort by updated_at to ensure we process most recent first
    const sortedRuns = [...workflowRuns].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    // Filter and keep only the most recent run for each workflow name
    for (const run of sortedRuns) {
      // Skip Dependabot workflows if the setting is enabled
      if (ignoreDependabot && run.actor?.login === "dependabot[bot]") {
        continue;
      }

      const workflowKey = run.name || "unknown-workflow";
      if (!workflowMap.has(workflowKey)) {
        workflowMap.set(workflowKey, run);
      }
    }

    // Return as array, sorted alphabetically by workflow name
    return Array.from(workflowMap.values()).sort((a, b) => {
      const nameA = (a.name || "unknown-workflow").toLowerCase();
      const nameB = (b.name || "unknown-workflow").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  async getRepositoryStatus(
    repository: Repository,
    maxRunsToFetch: number = 20,
    ignoreDependabot: boolean = false,
  ): Promise<{
    repository: Repository;
    workflowRuns: WorkflowRun[];
    error?: string;
  }> {
    try {
      const allWorkflowRuns = await this.getWorkflowRuns(
        repository.owner,
        repository.name,
        repository.branch,
        maxRunsToFetch,
      );

      // Deduplicate to keep only the latest run per workflow
      const uniqueWorkflowRuns = this.deduplicateWorkflowRuns(
        allWorkflowRuns,
        ignoreDependabot,
      );

      return {
        repository,
        workflowRuns: uniqueWorkflowRuns,
      };
    } catch (error) {
      return {
        repository,
        workflowRuns: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getAllRepositoryStatuses(
    repositories: Repository[],
    maxRunsToFetch: number = 20,
    ignoreDependabot: boolean = false,
  ): Promise<
    Array<{
      repository: Repository;
      workflowRuns: WorkflowRun[];
      error?: string;
    }>
  > {
    const enabledRepositories = repositories.filter((repo) => repo.enabled);

    // Process repositories in parallel, but with some throttling
    const promises = enabledRepositories.map((repo) =>
      this.getRepositoryStatus(repo, maxRunsToFetch, ignoreDependabot),
    );

    return Promise.all(promises);
  }
}

export function getWorkflowStatus(workflowRuns: WorkflowRun[]): {
  status: "success" | "failure" | "in_progress" | "cancelled" | "unknown";
  lastRun?: WorkflowRun;
} {
  if (workflowRuns.length === 0) {
    return { status: "unknown" };
  }

  // Get the most recent workflow run
  const lastRun = workflowRuns[0];

  if (lastRun.status === "in_progress" || lastRun.status === "queued") {
    return { status: "in_progress", lastRun };
  }

  if (lastRun.status === "completed") {
    switch (lastRun.conclusion) {
      case "success":
        return { status: "success", lastRun };
      case "failure":
        return { status: "failure", lastRun };
      case "cancelled":
        return { status: "cancelled", lastRun };
      default:
        return { status: "unknown", lastRun };
    }
  }

  return { status: "unknown", lastRun };
}
