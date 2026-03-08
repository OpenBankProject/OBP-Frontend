import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("ActivityTrailBootstrap");

/**
 * Schema definition for system_activity_trail — a system-level personal dynamic entity.
 *
 * Stores snapshots of data entities the user has encountered (users, consumers,
 * customers, accounts, products, etc.) to power Opey's "What should I know?" insights.
 *
 * Bank-scoped entities include a bank_id in the metadata field.
 */
const SYSTEM_ACTIVITY_TRAIL = {
	entity_name: "system_activity_trail",
	has_personal_entity: true,
	has_public_access: false,
	has_community_access: false,
	personal_requires_role: false,
	schema: {
		description:
			"Snapshots of data entities encountered by the user, for cross-entity insight generation.",
		required: ["timestamp", "entity_type", "entity_id", "summary"],
		properties: {
			timestamp: {
				type: "string",
				minLength: 20,
				maxLength: 30,
				example: "2026-03-06T14:32:00Z",
				description: "ISO 8601 timestamp of when the entity was encountered"
			},
			entity_type: {
				type: "string",
				minLength: 1,
				maxLength: 50,
				example: "customer",
				description:
					"Type of entity encountered, e.g. user, consumer, entitlement, customer, account, product, transaction, branch, atm"
			},
			entity_id: {
				type: "string",
				minLength: 1,
				maxLength: 200,
				example: "abc-123",
				description: "The specific OBP identifier of the entity"
			},
			summary: {
				type: "string",
				minLength: 1,
				maxLength: 2000,
				example:
					"ABC Corp - 3 accounts (2 GBP, 1 EUR), onboarded 2024-01, KYC complete",
				description:
					"Human-readable snapshot of the entity data at time of encounter"
			},
			metadata: {
				type: "string",
				minLength: 0,
				maxLength: 5000,
				example:
					'{"bank_id": "gh.29.uk", "account_count": 3, "currencies": ["GBP", "EUR"]}',
				description:
					"JSON-encoded structured data for machine reasoning. Include bank_id here for bank-scoped entities."
			}
		}
	}
};

/**
 * Ensure the system_activity_trail dynamic entity exists in OBP.
 * Creates it if missing. Requires CanCreateSystemLevelDynamicEntity consumer scope.
 *
 * Call once at startup (on first authenticated request).
 */
export async function ensureSystemActivityTrail(
	accessToken: string
): Promise<boolean> {
	const entityName = SYSTEM_ACTIVITY_TRAIL.entity_name;

	try {
		const response = await obp_requests.get(
			"/obp/v6.0.0/management/system-dynamic-entities",
			accessToken
		);
		const entities = response.dynamic_entities || [];
		const exists = entities.some(
			(e: { entity_name: string }) => e.entity_name === entityName
		);

		if (exists) {
			logger.info(`Dynamic entity '${entityName}' already exists.`);
			return true;
		}
	} catch (err) {
		logger.warn(
			`Could not list system dynamic entities — ` +
				`check that the API Manager consumer has CanCreateSystemLevelDynamicEntity scope: ${err}`
		);
		return false;
	}

	try {
		logger.info(`Creating dynamic entity '${entityName}'...`);
		await obp_requests.post(
			"/obp/v6.0.0/management/system-dynamic-entities",
			SYSTEM_ACTIVITY_TRAIL,
			accessToken
		);
		logger.info(`Dynamic entity '${entityName}' created successfully.`);
		return true;
	} catch (err) {
		logger.warn(
			`Failed to create dynamic entity '${entityName}'. ` +
				`Ensure the API Manager consumer has CanCreateSystemLevelDynamicEntity scope. Error: ${err}`
		);
		return false;
	}
}
