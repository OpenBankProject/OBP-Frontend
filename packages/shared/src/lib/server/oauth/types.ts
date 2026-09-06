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
export interface OpenIdConnectConfiguration {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
    revocation_endpoint?: string;
    introspection_endpoint?: string;
    device_authorization_endpoint?: string;
    end_session_endpoint?: string;
    check_session_iframe?: string;
    frontchannel_logout_supported?: boolean;
    frontchannel_logout_session_required?: boolean;
    backchannel_logout_supported?: boolean;
    backchannel_logout_session_required?: boolean;
    scopes_supported?: string[];
    response_types_supported: string[];
    response_modes_supported?: string[];
    grant_types_supported: string[];
    acr_values_supported?: string[];
    subject_types_supported: string[];
    id_token_signing_alg_values_supported: string[];
    id_token_encryption_alg_values_supported?: string[];
    id_token_encryption_enc_values_supported?: string[];
    userinfo_signing_alg_values_supported?: string[];
    userinfo_encryption_alg_values_supported?: string[];
    userinfo_encryption_enc_values_supported?: string[];
    request_object_signing_alg_values_supported?: string[];
    request_object_encryption_alg_values_supported?: string[];
    request_object_encryption_enc_values_supported?: string[];
    token_endpoint_auth_methods_supported?: string[];
    token_endpoint_auth_signing_alg_values_supported?: string[];
    display_values_supported?: string[];
    claim_types_supported?: string[];
    claims_supported?: string[];
    service_documentation?: string;
    claims_locales_supported?: string[];
    ui_locales_supported?: string[];
    op_policy_uri?: string;
    op_tos_uri?: string;
    registration_endpoint?: string;
    dpop_signing_alg_values_supported?: string[];
}

export interface OAuth2AccessTokenPayload {
    sub: string;
    iss: string;
    aud: string[];
    exp: number;
    iat: number;
    nbf?: number;
    jti?: string;
    scope?: string;
    client_id?: string;
    [key: string]: any; // Allow additional properties
}

export interface SessionOAuthStorageData {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    provider: string;
}