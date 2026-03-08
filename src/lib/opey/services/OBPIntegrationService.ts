import { createLogger } from "$lib/utils/logger";
const logger = createLogger("OBPIntegrationService");
import { extractUsernameFromJWT } from "$lib/utils/jwt";
import type { Session } from "svelte-kit-sessions";
import { obp_requests } from "$lib/obp/requests";
import type { OBPConsent, OBPConsentInfo } from "$lib/obp/types";
import { env } from "$env/dynamic/private";

export interface OBPIntegrationService {
  getOrCreateOpeyConsent(session: Session): Promise<OBPConsent>;
  checkExistingOpeyConsent(session: Session): Promise<OBPConsent | null>;
}

export class DefaultOBPIntegrationService implements OBPIntegrationService {
  constructor(private opeyConsumerId: string) {}

  async getOrCreateOpeyConsent(session: Session): Promise<OBPConsent> {
    if (!session.data.oauth?.access_token) {
      throw new Error("User not authenticated with OBP");
    }

    logger.info(`getOrCreateOpeyConsent: looking for existing ACCEPTED consent with consumer_id="${this.opeyConsumerId}"`);

    // Check for existing consent first
    const existingConsentId = await this.checkExistingOpeyConsent(session);
    if (existingConsentId) {
      const userIdentifier = extractUsernameFromJWT(existingConsentId.jwt);
      logger.info(
        `Found existing consent: consent_id="${existingConsentId.consent_id}", status="${existingConsentId.status}", consumer_id="${existingConsentId.consumer_id}" - user: ${userIdentifier}`,
      );
      return existingConsentId;
    }

    // Create new consent
    logger.info(`No existing ACCEPTED consent found - creating new IMPLICIT consent with consumer_id="${this.opeyConsumerId}"`);
    const consent = await this.createImplicitConsent(
      session.data.oauth.access_token,
    );
    const userIdentifier = extractUsernameFromJWT(consent.jwt);
    logger.info(`Created new consent: consent_id="${consent.consent_id}", status="${consent.status}", consumer_id="${consent.consumer_id}" - user: ${userIdentifier}`);
    return consent;
  }

  async getCurrentConsentInfo(
    session: Session,
  ): Promise<OBPConsentInfo | null> {
    if (!session.data.oauth?.access_token) {
      return null;
    }

    try {
      const currentConsent = await this.checkExistingOpeyConsent(session);
      return currentConsent
        ? {
            consent_id: currentConsent.consent_id,
            consumer_id: currentConsent.consumer_id,
            created_by_user_id: currentConsent.created_by_user_id,
            last_action_date: currentConsent.last_action_date,
            last_usage_date: currentConsent.last_usage_date,
            status: currentConsent.status,
            api_standard: currentConsent.api_standard,
            api_version: currentConsent.api_version,
          }
        : null;
    } catch (error) {
      logger.error(
        "[getCurrentConsentInfo] Error fetching current consent info:",
        error,
      );
      return null;
    }
  }

  async checkExistingOpeyConsent(session: Session): Promise<OBPConsent | null> {
    if (!session.data.oauth?.access_token) {
      return null;
    }

    try {
      const response = await obp_requests.get(
        "/obp/v6.0.0/my/consents",
        session.data.oauth.access_token,
      );
      const consents = response.consents || [];

      for (const consent of consents) {
        if (
          consent.consumer_id === this.opeyConsumerId &&
          consent.status === "ACCEPTED" &&
          !this.isConsentExpired(consent)
        ) {
          const userIdentifier = extractUsernameFromJWT(consent.jwt);
          logger.info(
            `Retrieved existing consent JWT - User: ${userIdentifier}`,
          );
          return consent;
        }
      }

      return null;
    } catch (error) {
      logger.info("Consent check failed - likely expired JWT:", error);
      return null;
    }
  }

  private async createImplicitConsent(
    accessToken: string,
  ): Promise<OBPConsent> {
    const now = new Date().toISOString().split(".")[0] + "Z";

    const body = {
      everything: true,
      entitlements: [],
      consumer_id: this.opeyConsumerId,
      views: [],
      valid_from: now,
      time_to_live: 3600,
    };

    const consent = await obp_requests.post(
      "/obp/v6.0.0/my/consents/IMPLICIT",
      body,
      accessToken,
    );
    const userIdentifier = extractUsernameFromJWT(consent.jwt);
    logger.info(`Created implicit consent - Primary user: ${userIdentifier}`);
    return consent;
  }

  private isConsentExpired(consent: any): boolean {
    const exp = consent.jwt_payload?.exp;
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    return exp < now;
  }
}

export const obpIntegrationService = new DefaultOBPIntegrationService(
  env.OPEY_CONSUMER_ID || "",
);
