/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { createLogger } from "@obp/shared/utils";
const logger = createLogger("OAuthSessionHelper");
import { oauth2ProviderFactory } from "./providerFactory";
import type { OAuth2ClientWithConfig } from "./client";
import type { Session } from "svelte-kit-sessions";

export interface SessionOAuthData {
  client: OAuth2ClientWithConfig;
  provider: string;
  accessToken: string;
  refreshToken?: string;
}

export class SessionOAuthHelper {
  /**
   * Get the OAuth client and tokens from session
   * @param session - The user session
   * @returns SessionOAuthData if valid, null if invalid/missing
   */
  static getSessionOAuth(session: Session): SessionOAuthData | null {
    logger.debug("🔐 SESSION OAUTH DEBUG - getSessionOAuth called");

    const oauthData = session.data.oauth;
    logger.debug(`  Session has oauth data: ${!!oauthData}`);
    logger.debug(`  OAuth provider: ${oauthData?.provider || "MISSING"}`);
    logger.debug(`  Access token present: ${!!oauthData?.access_token}`);
    logger.debug(`  Refresh token present: ${!!oauthData?.refresh_token}`);

    if (!oauthData?.provider || !oauthData?.access_token) {
      logger.warn("🔐 SESSION OAUTH - Missing provider or access token");
      return null;
    }

    const client = oauth2ProviderFactory.getClient(oauthData.provider);
    if (!client) {
      logger.error(
        `🔐 SESSION OAUTH - OAuth client for provider "${oauthData.provider}" not found.`,
      );
      return null;
    }

    logger.debug(
      `🔐 SESSION OAUTH - Successfully created SessionOAuthData for ${oauthData.provider}`,
    );

    return {
      client,
      provider: oauthData.provider,
      accessToken: oauthData.access_token,
      refreshToken: oauthData.refresh_token,
    };
  }

  static async updateTokensInSession(
    session: Session,
    accessToken: string,
    refreshToken?: string,
  ): Promise<void> {
    const currentOauth = session.data.oauth;
    if (!currentOauth) {
      throw new Error("No OAuth data in session to update.");
    }

    await session.setData({
      ...session.data,
      oauth: {
        ...currentOauth,
        access_token: accessToken,
        refresh_token: refreshToken || currentOauth.refresh_token, // Keep existing refresh token if not provided
      },
    });

    await session.save();
  }

  static async refreshAccessToken(session: Session): Promise<void> {
    logger.debug("Attempting to refresh access token in session...");

    const sessionOAuth = this.getSessionOAuth(session);
    if (!sessionOAuth) {
      logger.warn(
        "No valid OAuth data found in session. Cannot refresh access token.",
      );
      throw new Error(
        "No valid OAuth data found in session. Please log in again.",
      );
    }

    const { client, provider, refreshToken } = sessionOAuth;
    const refreshEndpoint = client.OIDCConfig?.token_endpoint;

    if (!refreshEndpoint || !refreshToken) {
      logger.warn(
        `No refresh endpoint or refresh token found for provider: ${provider}`,
      );
      throw new Error(
        "No refresh endpoint or refresh token found. Please log in again.",
      );
    }

    try {
      logger.debug(`Refreshing access token for provider: ${provider}...`);
      const tokens = await client.refreshAccessToken(
        refreshEndpoint,
        refreshToken,
        ["openid"],
      );

      // Google access tokens are opaque and can't be validated by OBP;
      // the id_token is the JWT that OBP verifies against Google's JWKS.
      await this.updateTokensInSession(
        session,
        provider === "google" ? tokens.idToken() : tokens.accessToken(),
        tokens.refreshToken() || refreshToken,
      );

      logger.info(
        `Access token refreshed successfully for provider: ${provider}`,
      );
    } catch (error) {
      logger.info(
        `Token refresh failed for provider ${provider} - this is normal OAuth behavior when tokens expire:`,
        error,
      );
      throw new Error("Failed to refresh access token. Please log in again.");
    }
  }
}
