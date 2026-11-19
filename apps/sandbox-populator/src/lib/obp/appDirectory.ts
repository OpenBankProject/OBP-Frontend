import type { AppDirectoryEntry } from './types';

/**
 * Derive a short key from an app directory entry name.
 * e.g. "public_obp_api_explorer_url" -> "api_explorer"
 *      "public_keycloak_url" -> "keycloak"
 */
function deriveKey(name: string): string {
	return name.replace(/^public_obp_|^public_/, '').replace(/_url$/, '');
}

/**
 * Derive a camelCase variable name from an app directory entry name.
 * e.g. "public_obp_api_explorer_url" -> "apiExplorer"
 */
export function deriveCamelName(name: string): string {
	return deriveKey(name).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Derive a display label from an app directory entry name.
 * e.g. "public_obp_api_explorer_url" -> "API Explorer"
 */
export function deriveLabel(name: string): string {
	return deriveKey(name)
		.split('_')
		.map((w) => w.toUpperCase())
		.join(' ');
}

/**
 * Build a lookup object from app directory entries, keyed by camelCase name.
 * e.g. { apiExplorer: "http://localhost:5173", apiManager: "http://localhost:3003", ... }
 */
export function buildAppUrls(directory: AppDirectoryEntry[]): Record<string, string> {
	const urls: Record<string, string> = {};
	for (const entry of directory) {
		if (entry.value) {
			urls[deriveCamelName(entry.name)] = entry.value;
		}
	}
	return urls;
}
