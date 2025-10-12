/**
 * Service for managing GitHub token storage and user settings in browser localStorage
 */

const GITHUB_TOKEN_KEY = 'github_token';
const IGNORE_DEPENDABOT_KEY = 'ignore_dependabot_workflows';

export class TokenStorage {
	/**
	 * Get the stored GitHub token from localStorage
	 */
	static getToken(): string | null {
		if (typeof window === 'undefined') {
			return null; // SSR safety
		}

		try {
			return localStorage.getItem(GITHUB_TOKEN_KEY);
		} catch (error) {
			console.error('Failed to get token from localStorage:', error);
			return null;
		}
	}

	/**
	 * Store the GitHub token in localStorage
	 */
	static setToken(token: string): void {
		if (typeof window === 'undefined') {
			return; // SSR safety
		}

		try {
			if (token.trim()) {
				localStorage.setItem(GITHUB_TOKEN_KEY, token.trim());
			} else {
				this.removeToken();
			}
		} catch (error) {
			console.error('Failed to store token in localStorage:', error);
		}
	}

	/**
	 * Remove the GitHub token from localStorage
	 */
	static removeToken(): void {
		if (typeof window === 'undefined') {
			return; // SSR safety
		}

		try {
			localStorage.removeItem(GITHUB_TOKEN_KEY);
		} catch (error) {
			console.error('Failed to remove token from localStorage:', error);
		}
	}

	/**
	 * Check if a token is currently stored
	 */
	static hasToken(): boolean {
		const token = this.getToken();
		return token !== null && token.trim() !== '';
	}

	/**
	 * Validate token format (basic check)
	 */
	static isValidTokenFormat(token: string): boolean {
		// GitHub personal access tokens are typically 40 characters (classic) or start with various prefixes
		const trimmed = token.trim();
		return trimmed.length >= 4 && (
			/^[a-f0-9]{40}$/i.test(trimmed) || // Classic token
			/^ghp_[a-zA-Z0-9]{36}$/.test(trimmed) || // Fine-grained personal access token
			/^gho_[a-zA-Z0-9]{36}$/.test(trimmed) || // OAuth token
			/^ghu_[a-zA-Z0-9]{36}$/.test(trimmed) || // User-to-server token
			/^ghs_[a-zA-Z0-9]{36}$/.test(trimmed) || // Server-to-server token
			/^ghr_[a-zA-Z0-9]{36}$/.test(trimmed) || // Refresh token
			/^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/.test(trimmed) // New GitHub PAT format
		);
	}

	/**
	 * Get the ignore Dependabot workflows setting
	 */
	static getIgnoreDependabot(): boolean {
		if (typeof window === 'undefined') {
			return false; // SSR safety
		}

		try {
			const value = localStorage.getItem(IGNORE_DEPENDABOT_KEY);
			return value === 'true';
		} catch (error) {
			console.error('Failed to get ignore Dependabot setting from localStorage:', error);
			return false;
		}
	}

	/**
	 * Set the ignore Dependabot workflows setting
	 */
	static setIgnoreDependabot(ignore: boolean): void {
		if (typeof window === 'undefined') {
			return; // SSR safety
		}

		try {
			localStorage.setItem(IGNORE_DEPENDABOT_KEY, ignore.toString());
		} catch (error) {
			console.error('Failed to store ignore Dependabot setting in localStorage:', error);
		}
	}
}
