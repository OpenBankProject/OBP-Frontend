// OBP-API deployments conventionally expose gRPC on a `grpc.` subdomain of the
// REST host, so when OBP_GRPC_HOST is unset the default is
// grpc.<PUBLIC_OBP_BASE_URL hostname>:50051 — not localhost, which only works
// when the frontend and OBP-API share a host. localhost and IP literals get no
// `grpc.` prefix (there is no subdomain to resolve there).

export const DEFAULT_GRPC_PORT = 50051;

/**
 * The gRPC host:port to connect to, resolved from an env-like record:
 * OBP_GRPC_HOST when set, otherwise derived from PUBLIC_OBP_BASE_URL. Pass
 * `process.env`, or spread SvelteKit's dynamic env objects:
 * `resolveGrpcHost({ ...env, ...publicEnv })`.
 */
export function resolveGrpcHost(env: {
	OBP_GRPC_HOST?: string;
	PUBLIC_OBP_BASE_URL?: string;
}): string {
	return env.OBP_GRPC_HOST || defaultGrpcHost(env.PUBLIC_OBP_BASE_URL);
}

export function defaultGrpcHost(obpBaseUrl: string | undefined | null): string {
	if (obpBaseUrl) {
		try {
			const hostname = new URL(obpBaseUrl).hostname;
			return `${grpcSubdomainApplies(hostname) ? 'grpc.' : ''}${hostname}:${DEFAULT_GRPC_PORT}`;
		} catch {
			// unparseable base URL — fall through to localhost
		}
	}
	return `localhost:${DEFAULT_GRPC_PORT}`;
}

function grpcSubdomainApplies(hostname: string): boolean {
	if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
		return false;
	}
	// IPv4 literal; IPv6 literals contain ':' (URL.hostname keeps their brackets)
	return !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':');
}
