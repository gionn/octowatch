import * as yaml from 'js-yaml';
import { asset } from '$app/paths';
import type { Config, RepositoryGroup, Repository } from '../types/github.js';

// Configuration cache and watching
let configCache: Config | null = null;
let configTimestamp: number = 0;

export async function loadConfig(): Promise<Config> {
	try {
		// Fetch config.yaml from static directory
		if (typeof window !== 'undefined') {
			const response = await fetch(asset('/config.yaml') + '?' + Date.now());
			if (response.ok) {
				const yamlContent = await response.text();
				const config = await loadConfigFromYaml(yamlContent);
				configCache = config;
				configTimestamp = Date.now();
				return config;
			} else {
				throw new Error(`Failed to fetch config.yaml: ${response.status} ${response.statusText}`);
			}
		}

		// Server-side fallback (shouldn't be used in SPA, but good to have)
		throw new Error('Configuration can only be loaded in browser environment');
	} catch (error) {
		console.error('Failed to load configuration:', error);
		throw new Error('Configuration loading failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
	}
}

export function getCachedConfig(): Config | null {
	return configCache;
}

export function getConfigTimestamp(): number {
	return configTimestamp;
}

export async function loadConfigFromYaml(yamlContent: string): Promise<Config> {
	try {
		const config = yaml.load(yamlContent) as Config;

		// Validate required fields - support both new grouped format and legacy flat format
		if (config.repository_groups) {
			if (!Array.isArray(config.repository_groups)) {
				throw new Error('Invalid configuration: repository_groups must be an array');
			}
		} else if (config.repositories) {
			if (!Array.isArray(config.repositories)) {
				throw new Error('Invalid configuration: repositories must be an array');
			}
		} else {
			throw new Error('Invalid configuration: either repository_groups or repositories must be provided');
		}

		// Set defaults if not provided
		config.github = config.github || { api_url: 'https://api.github.com' };
		config.dashboard = config.dashboard || {
			refresh_interval: 30,
			max_runs_to_fetch: 20,
			show_statuses: ['success', 'failure', 'in_progress']
		};

		// Handle legacy config field name
		if ('max_runs_per_repo' in config.dashboard) {
			config.dashboard.max_runs_to_fetch = (config.dashboard as any).max_runs_per_repo;
		}

		return config;
	} catch (error) {
		console.error('Failed to parse YAML configuration:', error);
		throw new Error('YAML parsing failed');
	}
}

// Get all repository groups from config
export function getRepositoryGroups(config: Config): RepositoryGroup[] {
	if (config.repository_groups) {
		return config.repository_groups.filter(group => group.enabled);
	}

	// Legacy support: convert flat repository list to a single group
	if (config.repositories) {
		return [{
			name: 'All Repositories',
			slug: 'all',
			description: 'All configured repositories',
			enabled: true,
			repositories: config.repositories
		}];
	}

	return [];
}

// Get a specific repository group by slug
export function getRepositoryGroupBySlug(config: Config, slug: string): RepositoryGroup | null {
	const groups = getRepositoryGroups(config);
	return groups.find(group => group.slug === slug) || null;
}

// Get all repositories from all enabled groups (useful for global operations)
export function getAllRepositories(config: Config): Repository[] {
	const groups = getRepositoryGroups(config);
	const allRepositories: Repository[] = [];

	for (const group of groups) {
		for (const repo of group.repositories) {
			if (repo.enabled) {
				allRepositories.push(repo);
			}
		}
	}

	return allRepositories;
}
