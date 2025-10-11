import yaml from 'js-yaml';
import type { Config } from '../types/github.js';

export async function loadConfig(): Promise<Config> {
	try {
		// In a real implementation, you would fetch this from a server or static file
		// For now, we'll return a default configuration
		const defaultConfig: Config = {
			repositories: [
				{
					name: 'example-repo-1',
					owner: 'octocat',
					url: 'https://github.com/octocat/example-repo-1',
					branch: 'main',
					enabled: true
				},
				{
					name: 'example-repo-2',
					owner: 'octocat',
					url: 'https://github.com/octocat/example-repo-2',
					branch: 'main',
					enabled: true
				}
			],
			github: {
				token: '',
				api_url: 'https://api.github.com'
			},
			dashboard: {
				refresh_interval: 30,
				max_runs_per_repo: 5,
				show_statuses: ['success', 'failure', 'in_progress']
			}
		};

		return defaultConfig;
	} catch (error) {
		console.error('Failed to load configuration:', error);
		throw new Error('Configuration loading failed');
	}
}

export async function loadConfigFromYaml(yamlContent: string): Promise<Config> {
	try {
		const config = yaml.load(yamlContent) as Config;
		
		// Validate required fields
		if (!config.repositories || !Array.isArray(config.repositories)) {
			throw new Error('Invalid configuration: repositories must be an array');
		}

		// Set defaults if not provided
		config.github = config.github || { api_url: 'https://api.github.com' };
		config.dashboard = config.dashboard || {
			refresh_interval: 30,
			max_runs_per_repo: 5,
			show_statuses: ['success', 'failure', 'in_progress']
		};

		return config;
	} catch (error) {
		console.error('Failed to parse YAML configuration:', error);
		throw new Error('YAML parsing failed');
	}
}