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
import { env } from '$env/dynamic/public';
import { createOBPRequests, type OBPRequests } from '@obp/shared/obp';

let instance: OBPRequests | null = null;

// Created on first use: PUBLIC_OBP_BASE_URL is read at runtime, and is not set during `vite build`.
function requests(): OBPRequests {
	instance ??= createOBPRequests(env.PUBLIC_OBP_BASE_URL ?? '');
	return instance;
}

/** Server-side calls to OBP-API. The browser never calls OBP directly. */
export const obpRequests = {
	get: (endpoint: string, accessToken?: string) => requests().get(endpoint, accessToken),
	post: (endpoint: string, body: unknown, accessToken?: string) =>
		requests().post(endpoint, body, accessToken),
	put: (endpoint: string, body: unknown, accessToken?: string) =>
		requests().put(endpoint, body, accessToken),
	patch: (endpoint: string, body: unknown, accessToken?: string) =>
		requests().patch(endpoint, body, accessToken),
	delete: (endpoint: string, accessToken?: string) => requests().delete(endpoint, accessToken)
};
