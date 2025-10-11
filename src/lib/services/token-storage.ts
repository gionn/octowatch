/**
 * Service for managing GitHub token storage in browser localStorage
 */

const GITHUB_TOKEN_KEY = 'github_token';

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
		// GitHub personal access tokens are typically 40 characters (classic) or start with 'ghp_' (fine-grained)
		const trimmed = token.trim();
		return trimmed.length >= 4 && (
			/^[a-f0-9]{40}$/i.test(trimmed) || // Classic token
			/^ghp_[a-zA-Z0-9]{36}$/.test(trimmed) || // Fine-grained personal access token
			/^gho_[a-zA-Z0-9]{36}$/.test(trimmed) || // OAuth token
			/^ghu_[a-zA-Z0-9]{36}$/.test(trimmed) || // User-to-server token
			/^ghs_[a-zA-Z0-9]{36}$/.test(trimmed)    // Server-to-server token
		);
	}
}
