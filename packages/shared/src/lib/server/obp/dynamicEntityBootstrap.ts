/**
 * Ensure a system-level dynamic entity definition exists in OBP, using an application
 * access token (client_credentials). Used by apps at startup for the entities they own,
 * e.g. an app's Opey conversation entity. A missing token or scope only logs a warning:
 * the app starts, and the feature that needs the entity reports it as unavailable.
 *
 * An entity that already exists is brought up to date when the definition in the repo
 * has moved on: a different auth_mode, or schema properties the instance does not have
 * yet (for example a field added to the conversation record). Properties are only ever
 * added, never removed, so rows written by an older build stay valid.
 */
import { createLogger } from '$shared/utils/logger';

const logger = createLogger('DynamicEntityBootstrap');

export interface SystemDynamicEntityDefinition {
	entity_name: string;
	auth_mode?: string;
	schema?: { properties?: Record<string, unknown>; [k: string]: unknown };
	[k: string]: unknown;
}

export interface DynamicEntityBootstrapDeps {
	get: (path: string, accessToken: string) => Promise<any>;
	post: (path: string, body: any, accessToken: string) => Promise<any>;
	/** Needed to update an existing entity; without it a stale entity is only logged. */
	put?: (path: string, body: any, accessToken: string) => Promise<any>;
	accessToken: string | null;
}

const SYSTEM_ENTITIES = '/obp/v6.0.0/management/system-dynamic-entities';

/** Why an existing entity differs from the definition; empty when it is current. */
export function dynamicEntityDrift(existing: any, definition: SystemDynamicEntityDefinition): string[] {
	const reasons: string[] = [];
	const currentMode = existing?.auth_mode ?? 'UserOnly';
	const wantedMode = definition.auth_mode ?? 'UserOnly';
	if (currentMode !== wantedMode) reasons.push(`auth_mode ${currentMode} -> ${wantedMode}`);
	const have = Object.keys(existing?.schema?.properties ?? {});
	const missing = Object.keys(definition.schema?.properties ?? {}).filter((k) => !have.includes(k));
	if (missing.length > 0) reasons.push(`missing properties: ${missing.join(', ')}`);
	return reasons;
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
		const response = await deps.get(SYSTEM_ENTITIES, deps.accessToken);
		const existing = (response?.dynamic_entities ?? []).find((e: { entity_name: string }) => e.entity_name === name);
		if (existing) {
			const drift = dynamicEntityDrift(existing, definition);
			if (drift.length === 0) {
				logger.info(`Dynamic entity '${name}' already exists and is current.`);
				return true;
			}
			if (!deps.put || !existing.dynamic_entity_id) {
				logger.warn(`Dynamic entity '${name}' exists but is out of date (${drift.join('; ')}); update it in the API Manager.`);
				return true;
			}
			try {
				await deps.put(`${SYSTEM_ENTITIES}/${encodeURIComponent(existing.dynamic_entity_id)}`, definition, deps.accessToken);
				logger.info(`Dynamic entity '${name}' updated (${drift.join('; ')}).`);
			} catch (err) {
				logger.warn(`Dynamic entity '${name}' exists but could not be updated (${drift.join('; ')}): ${err}`);
			}
			return true;
		}
	} catch (err) {
		logger.warn(`Could not list system dynamic entities (needs CanCreateSystemLevelDynamicEntity scope): ${err}`);
		return false;
	}
	try {
		await deps.post(SYSTEM_ENTITIES, definition, deps.accessToken);
		logger.info(`Dynamic entity '${name}' created.`);
		return true;
	} catch (err) {
		logger.warn(`Failed to create dynamic entity '${name}': ${err}`);
		return false;
	}
}
