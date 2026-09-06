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
import { env } from "$env/dynamic/public";
import { browser } from "$app/environment";

declare const process: { env: Record<string, string | undefined>; argv: string[] };

// Application configuration interface
export interface AppConfiguration {
  obp: {
    baseUrl: string;
    apiUrl: string;
    oidcUrl: string;
    host: string;
    port: number;
  };
  app: {
    baseUrl: string;
    port: number;
    callbackUrl: string;
  };
  oauth: {
    clientId: string;
    scope: string[];
  };
  features: {
    apiAccess: boolean;
    metricsEnabled: boolean;
    realTimeUpdates: boolean;
  };
}

// Default configuration values
const DEFAULT_OBP_BASE_URL = "http://127.0.0.1:9000";
const DEFAULT_APP_PORT = 3003;

// Parse URL to extract host and port information
function parseUrlInfo(url: string) {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parsedUrl.port
        ? parseInt(parsedUrl.port)
        : parsedUrl.protocol === "https:"
          ? 443
          : 80,
      protocol: parsedUrl.protocol.replace(":", ""),
    };
  } catch (error) {
    // Fallback parsing for cases where URL might be malformed
    const match = url.match(/^(https?):\/\/([^:\/]+)(?::(\d+))?/);
    if (match) {
      return {
        host: match[2],
        port: match[3] ? parseInt(match[3]) : match[1] === "https" ? 443 : 80,
        protocol: match[1],
      };
    }
    return {
      host: "localhost",
      port: 9000,
      protocol: "http",
    };
  }
}

// Get configuration from environment variables
function getConfiguration(): AppConfiguration {
  const obpBaseUrl = env.PUBLIC_OBP_BASE_URL || DEFAULT_OBP_BASE_URL;
  const obpInfo = parseUrlInfo(obpBaseUrl);

  // Construct URLs based on base URL
  const apiUrl = `${obpBaseUrl}/obp/v6.0.0`;
  const oidcUrl = `${obpBaseUrl}/obp-oidc`;

  // App configuration - use safe defaults on client side
  const appPort = browser
    ? DEFAULT_APP_PORT
    : process.env.PORT
      ? parseInt(process.env.PORT)
      : DEFAULT_APP_PORT;
  const appBaseUrl = `http://localhost:${appPort}`;
  const callbackUrl = browser
    ? `${appBaseUrl}/login/obp/callback`
    : process.env.APP_CALLBACK_URL || `${appBaseUrl}/login/obp/callback`;

  return {
    obp: {
      baseUrl: obpBaseUrl,
      apiUrl: apiUrl,
      oidcUrl: oidcUrl,
      host: obpInfo.host,
      port: obpInfo.port,
    },
    app: {
      baseUrl: appBaseUrl,
      port: appPort,
      callbackUrl: callbackUrl,
    },
    oauth: {
      clientId: browser
        ? "39fb9d38-cd0e-44e7-9da5-556d0673e40d"
        : process.env.OBP_OAUTH_CLIENT_ID ||
          "39fb9d38-cd0e-44e7-9da5-556d0673e40d",
      scope: ["openid", "profile", "email"],
    },
    features: {
      apiAccess: true, // Will be determined at runtime
      metricsEnabled: true,
      realTimeUpdates: true,
    },
  };
}

// Export the configuration
export const config = getConfiguration();

// Helper functions for common configuration needs
export const configHelpers = {
  // Get OBP connection status info
  getObpConnectionInfo() {
    return {
      host: config.obp.host,
      port: config.obp.port,
      baseUrl: config.obp.baseUrl,
      apiUrl: config.obp.apiUrl,
      oidcUrl: config.obp.oidcUrl,
      displayName: `${config.obp.host}:${config.obp.port}`,
    };
  },

  // Get app connection info
  getAppConnectionInfo() {
    return {
      port: config.app.port,
      baseUrl: config.app.baseUrl,
      callbackUrl: config.app.callbackUrl,
    };
  },

  // Check if URLs are using secure protocols
  isSecure() {
    return {
      obp: config.obp.baseUrl.startsWith("https://"),
      app: config.app.baseUrl.startsWith("https://"),
    };
  },

  // Get environment summary
  getEnvironmentSummary() {
    const obpInfo = this.getObpConnectionInfo();
    const appInfo = this.getAppConnectionInfo();
    const security = this.isSecure();

    return {
      environment: "development", // Could be enhanced to detect actual environment
      obp: {
        ...obpInfo,
        secure: security.obp,
        status: "unknown", // Will be determined at runtime
      },
      app: {
        ...appInfo,
        secure: security.app,
      },
      features: config.features,
    };
  },

  // Format configuration for display
  formatForDisplay() {
    const summary = this.getEnvironmentSummary();

    return {
      "OBP Server": {
        Host: summary.obp.displayName,
        "Base URL": summary.obp.baseUrl,
        "API URL": summary.obp.apiUrl,
        "OIDC URL": summary.obp.oidcUrl,
        Secure: summary.obp.secure ? "Yes" : "No",
      },
      Application: {
        Port: summary.app.port.toString(),
        "Base URL": summary.app.baseUrl,
        "Callback URL": summary.app.callbackUrl,
        Secure: summary.app.secure ? "Yes" : "No",
      },
      OAuth: {
        "Client ID": config.oauth.clientId,
        Scopes: config.oauth.scope.join(", "),
      },
      Features: {
        "API Access": config.features.apiAccess ? "Enabled" : "Disabled",
        Metrics: config.features.metricsEnabled ? "Enabled" : "Disabled",
        "Real-time Updates": config.features.realTimeUpdates
          ? "Enabled"
          : "Disabled",
      },
    };
  },
};

// AppConfiguration is already exported at its definition above

// Constants for common use
export const OBP_HOST = config.obp.host;
export const OBP_PORT = config.obp.port;
export const OBP_BASE_URL = config.obp.baseUrl;
export const OBP_API_URL = config.obp.apiUrl;
export const APP_PORT = config.app.port;
export const APP_BASE_URL = config.app.baseUrl;
