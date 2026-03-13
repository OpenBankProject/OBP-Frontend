import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "$lib/utils/logger";
import { oauth2ProviderFactory } from "$lib/oauth/providerFactory";
import { env } from "$env/dynamic/private";

const logger = createLogger("OpeyNotebookBootstrap");

/**
 * Schema definition for opey_notebook — a system-level personal dynamic entity.
 *
 * An informal scratchpad where Opey jots down things it notices as the user
 * navigates around. These notes give Opey context for insights like
 * "What should I know?"
 */
const OPEY_NOTEBOOK = {
	entity_name: "opey_notebook",
	has_personal_entity: true,
	has_public_access: false,
	has_community_access: false,
	personal_requires_role: false,
	schema: {
		description:
			"Informal notes about what the user has encountered, giving Opey context for insights.",
		required: ["timestamp", "note"],
		properties: {
			timestamp: {
				type: "string",
				minLength: 20,
				maxLength: 30,
				example: "2026-03-06T14:32:00Z",
				description: "ISO 8601 timestamp of when the observation was made"
			},
			note: {
				type: "string",
				minLength: 1,
				maxLength: 2000,
				example:
					"Viewed customer ABC Corp at bank gh.29.uk — 3 accounts (2 GBP, 1 EUR), onboarded 2024-01, KYC complete",
				description:
					"Natural language note about what the user encountered or what Opey observed"
			}
		}
	}
};

/**
 * Fetch an application access token using the client_credentials grant.
 * This allows the API Manager to call OBP endpoints at startup without
 * needing a logged-in user, as long as the consumer has the required scope.
 */
async function getApplicationAccessToken(): Promise<string | null> {
	const client = oauth2ProviderFactory.getPrimaryClient();
	if (!client?.OIDCConfig?.token_endpoint) {
		logger.warn("No OAuth client or token endpoint available for application access.");
		return null;
	}

	const body = new URLSearchParams();
	body.set("grant_type", "client_credentials");
	body.set("client_id", env.OBP_OAUTH_CLIENT_ID);
	body.set("client_secret", env.OBP_OAUTH_CLIENT_SECRET);

	try {
		const response = await fetch(client.OIDCConfig.token_endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Accept: "application/json",
			},
			body: body.toString(),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			logger.warn(
				`Application access token request failed: ${response.status} ${response.statusText}`,
				errorData
			);
			return null;
		}

		const tokens = await response.json();
		logger.info("Application access token obtained successfully.");
		return tokens.access_token;
	} catch (err) {
		logger.warn(`Failed to obtain application access token: ${err}`);
		return null;
	}
}

/**
 * Ensure the opey_notebook dynamic entity exists in OBP.
 * Creates it if missing. Uses application access (client_credentials) so
 * this can run at startup without a logged-in user.
 *
 * Requires the API Manager consumer to have the CanCreateSystemLevelDynamicEntity scope.
 */
export async function ensureOpeyNotebook(): Promise<boolean> {
	const entityName = OPEY_NOTEBOOK.entity_name;

	const accessToken = await getApplicationAccessToken();
	if (!accessToken) {
		logger.warn(
			`Cannot bootstrap '${entityName}' — failed to get application access token. ` +
				`Ensure the API Manager consumer supports client_credentials grant.`
		);
		return false;
	}

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
			OPEY_NOTEBOOK,
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
