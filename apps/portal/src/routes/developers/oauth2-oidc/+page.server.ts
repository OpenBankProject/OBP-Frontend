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
import { oauth2ProviderManager } from '$lib/oauth/providerManager';
import type { PageServerLoad } from './$types';

// OBP-OIDC serves its status page at the root of its host
function obpOidcStatusUrl(discoveryUrl: string): string | null {
	try {
		return `${new URL(discoveryUrl).origin}/status`;
	} catch {
		return null;
	}
}

// The OIDC servers OBP reports at its well-known endpoint (oauth2.oidc_provider),
// from the provider manager's cached list. Whether this Portal can log in with
// a provider is not shown: that is the Portal's config, not the developer's.
export const load: PageServerLoad = async () => {
	const identityProviders = oauth2ProviderManager.getReportedProviders().map((p) => ({
		provider: p.provider,
		discoveryUrl: p.url ?? null,
		statusUrl: p.provider === 'obp-oidc' && p.url ? obpOidcStatusUrl(p.url) : null
	}));
	return { identityProviders };
};
