/**
 * Ensure a system-level dynamic entity definition exists in OBP, using an application
 * access token (client_credentials). Used by apps at startup for the entities they own,
 * e.g. an app's Opey conversation entity. A missing token or scope only logs a warning:
 * the app starts, and the feature that needs the entity reports it as unavailable.
 */
import { createLogger } from '$shared/utils/logger';

const logger = createLogger('DynamicEntityBootstrap');

export interface SystemDynamicEntityDefinition {
	entity_name: string;
	[k: string]: unknown;
}

export interface DynamicEntityBootstrapDeps {
	get: (path: string, accessToken: string) => Promise<any>;
	post: (path: string, body: any, accessToken: string) => Promise<any>;
	accessToken: string | null;
}

export async function ensureSystemDynamicEntity(
	definition: SystemDynamicEntityDefinition,
	deps: DynamicEntityBootstrapDeps
): Promise<boolean> {
	const name = definition.entity_name;
	if (!deps.accessToken) {
		logger.warn(`Cannot bootstrap '${name}': no application access token (client_credentials).`);
		return false;
	}
	try {
		const response = await deps.get('/obp/v6.0.0/management/system-dynamic-entities', deps.accessToken);
		const existing = (response?.dynamic_entities ?? []).find((e: { entity_name: string }) => e.entity_name === name);
		if (existing) {
			logger.info(`Dynamic entity '${name}' already exists.`);
			return true;
		}
	} catch (err) {
		logger.warn(`Could not list system dynamic entities (needs CanCreateSystemLevelDynamicEntity scope): ${err}`);
		return false;
	}
	try {
		await deps.post('/obp/v6.0.0/management/system-dynamic-entities', definition, deps.accessToken);
		logger.info(`Dynamic entity '${name}' created.`);
		return true;
	} catch (err) {
		logger.warn(`Failed to create dynamic entity '${name}': ${err}`);
		return false;
	}
}
