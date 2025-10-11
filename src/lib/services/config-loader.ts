import yaml from 'js-yaml';
import type { Config } from '../types/github.js';

// Configuration cache and watching
let configCache: Config | null = null;
let configTimestamp: number = 0;

export async function loadConfig(): Promise<Config> {
	try {
		// Fetch config.yaml from static directory
		if (typeof window !== 'undefined') {
			const response = await fetch('/config.yaml?' + Date.now());
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