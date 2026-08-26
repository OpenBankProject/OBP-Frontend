import { createLogger } from '$shared/utils/logger';
const logger = createLogger('OBPIntegrationService');
import { extractUsernameFromJWT } from '$shared/utils/jwt';
import type { Session } from 'svelte-kit-sessions';
import type { OBPRequests } from '$shared/obp/requests';
import type { OBPConsent, OBPConsentInfo } from '$shared/obp/types';
import { capConsentTtlSeconds } from './consentsConfig.js';

export interface OBPIntegrationService {
  getOrCreateOpeyConsent(session: Session): Promise<OBPConsent>;
  checkExistingOpeyConsent(session: Session): Promise<OBPConsent | null>;
}

export class DefaultOBPIntegrationService implements OBPIntegrationService {
  constructor(
    private opeyConsumerId: string,
    private obpRequests: OBPRequests
  ) {}

  async getOrCreateOpeyConsent(session: Session): Promise<OBPConsent> {
    if (!session.data.oauth?.access_token) {
      throw new Error('User not authenticated with OBP');
    }

    // Check for existing consent first
    const existingConsentId = await this.checkExistingOpeyConsent(session);
    if (existingConsentId) {
      const userIdentifier = extractUsernameFromJWT(existingConsentId.jwt);
      logger.info(`getOrCreateOpeyConsent says: Found existing consent JWT - Primary user: ${userIdentifier}`);
      return existingConsentId;
    }

    // Create new consent
    const consent = await this.createImplicitConsent(session.data.oauth.access_token);
    const userIdentifier = extractUsernameFromJWT(consent.jwt);
    logger.info(`getOrCreateOpeyConsent says: Created new consent JWT - Primary user: ${userIdentifier}`);
    return consent;
  }

  async getCurrentConsentInfo(session: Session): Promise<OBPConsentInfo | null> {
	if (!session.data.oauth?.access_token) {
		return null;
	}

	try {
		const currentConsent = await this.checkExistingOpeyConsent(session);
		return currentConsent ? {
			consent_id: currentConsent.consent_id,
			consumer_id: currentConsent.consumer_id,
			created_by_user_id: currentConsent.created_by_user_id,
			last_action_date: currentConsent.last_action_date,
			last_usage_date: currentConsent.last_usage_date,
			status: currentConsent.status,
			api_standard: currentConsent.api_standard,
			api_version: currentConsent.api_version
		} : null;
	} catch (error) {
		logger.error('[getCurrentConsentInfo] Error fetching current consent info:', error);
		return null;
	}
  }

  async checkExistingOpeyConsent(session: Session): Promise<OBPConsent | null> {
    if (!session.data.oauth?.access_token) {
      return null;
    }

    try {
      const response = await this.obpRequests.get('/obp/v5.1.0/my/consents', session.data.oauth.access_token);
      const consents = response.consents || [];

			logger.debug(`checkExistingOpeyConsent: Found ${consents.length} total consents`);
			logger.debug(`checkExistingOpeyConsent: Looking for consumer_id: ${this.opeyConsumerId}`);

			for (const consent of consents) {
				logger.debug(
					`checkExistingOpeyConsent: Checking consent ${consent.consent_id} - consumer_id: ${consent.consumer_id}, status: ${consent.status}`
				);

				if (
					consent.consumer_id === this.opeyConsumerId &&
					consent.status === 'ACCEPTED' &&
					!this.isConsentExpired(consent)
				) {
					logger.debug(`checkExistingOpeyConsent: Found matching consent ${consent.consent_id}`);

					const userIdentifier = extractUsernameFromJWT(consent.jwt);
					logger.info(
						`checkExistingOpeyConsent says: Retrieved existing consent JWT - User: ${userIdentifier}`
					);
					return consent;
				} else if (consent.consumer_id === this.opeyConsumerId) {
					logger.debug(
						`checkExistingOpeyConsent: Found Opey consent but status is ${consent.status} or consent is expired`
					);
				}
			}

			logger.debug('checkExistingOpeyConsent: No matching consent found');
			return null;
		} catch (error) {
			logger.info(
				'checkExistingOpeyConsent says: Consent check failed - likely expired JWT:',
				error
			);
			return null;
		}
	}

	private async createImplicitConsent(accessToken: string): Promise<OBPConsent> {
		const now = new Date().toISOString().split('.')[0] + 'Z';

		// Cap the desired TTL against OBP's `consents.max_time_to_live` (via the
		// public /obp/v7.0.0/public/consent-config endpoint) to avoid OBP-35020 on
		// consent creation. The helper returns the desired value unchanged when
		// the endpoint isn't available (older OBP versions).
		const desiredTtl = 18000; // 5 hours
		const { ttl, max: serverMaxTtl, capped: ttlWasCapped } = await capConsentTtlSeconds(
			desiredTtl,
			(p, t) => this.obpRequests.get(p, t)
		);
		if (ttlWasCapped) {
			logger.info(
				`createImplicitConsent: TTL capped to OBP max — requested ${desiredTtl}s, server max ${serverMaxTtl}s, using ${ttl}s`
			);
		}

		const body = {
			// Baseline session consent: authenticates the user with Opey but grants
			// no elevated access. Specific roles are granted on demand by the
			// per-tool-call flow (/api/opey/consent).
			everything: false,
			entitlements: [],
			consumer_id: this.opeyConsumerId,
			views: [],
			valid_from: now,
			time_to_live: ttl
		};

		const consent = await this.obpRequests.post('/obp/v5.1.0/my/consents/IMPLICIT', body, accessToken);
		const userIdentifier = extractUsernameFromJWT(consent.jwt);
		logger.info(
			`createImplicitConsent says: Created implicit consent - Primary user: ${userIdentifier}`
		);
		return consent;
	}

	private isConsentExpired(consent: any): boolean {
		// OBP returns `jwt_payload` as a JSON string in this listing, so reading
		// `.exp` off it silently yields undefined. Use the dedicated
		// `jwt_expires_at` field (ISO timestamp) instead — that's what makes
		// reuse via checkExistingOpeyConsent() actually work.
		if (!consent.jwt_expires_at) return true;
		return new Date(consent.jwt_expires_at) < new Date();
	}
}
