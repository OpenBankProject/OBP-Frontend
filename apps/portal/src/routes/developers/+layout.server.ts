import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const rawHost = publicEnv.PUBLIC_OBP_BASE_URL || '';
	// Strip protocol for display in code examples
	const apiHost = rawHost.replace(/^https?:\/\//, '');
	// Strip query params and trailing slash to get a clean base for constructing links
	const rawExplorerUrl = env.API_EXPLORER_URL || '';
	const apiExplorerUrl = rawExplorerUrl.split('?')[0].replace(/\/$/, '');
	// The OBP-MCP server URL is advertised by the OBP backend via the
	// app-directory (public_obp_mcp_url) and surfaced by the root layout load.
	const { publicObpMcpUrl } = await parent();
	return {
		apiHost,
		apiBaseUrl: rawHost,
		apiExplorerUrl,
		mcpUrl: publicObpMcpUrl ?? ''
	};
};
