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
import { externalRedirectProblem } from '@obp/shared/utils';

/**
 * This module reads the Berlin Group TPP redirect addresses from a consent, for the pages that confirm,
 * refuse or finish a Berlin Group consent.
 *
 * The TPP sends TPP-Redirect-URI (where the PSU goes after a successful authorisation) and, optionally,
 * TPP-Nok-Redirect-URI (where the PSU goes after a failed or refused one) on its request. OBP keeps the
 * request headers in the consent JWT as [{name, values}], the shape OBP's HTTPParam serialises to. The
 * addresses are always read from the consent the server fetched, never from the browser, and each is
 * checked against the redirect URL rules, because a consent created before OBP-API checked them can
 * still carry an unsafe one.
 */

export interface TppRedirects {
	/** TPP-Redirect-URI when present and allowed, else ''. */
	tppRedirectUri: string;
	/** Where to send the PSU after a refusal: TPP-Nok-Redirect-URI, else TPP-Redirect-URI, when allowed; else ''. */
	nokRedirectUri: string;
	/** Why a TPP-Redirect-URI that was present is not used, or null. */
	tppRedirectUriProblem: string | null;
}

/** The payload of a JWT, or {} when it cannot be read. The signature is not checked: OBP-API issued it. */
export function decodeJwtPayload(jwt: string | null | undefined): any {
	try {
		const parts = (jwt ?? '').split('.');
		if (parts.length !== 3) return {};
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
	} catch {
		return {};
	}
}

/** The TPP redirect addresses of a consent returned by OBP-API (it must carry its `jwt`). */
export function tppRedirectsOf(consent: { jwt?: string } | null | undefined): TppRedirects {
	const requestHeaders: any[] = decodeJwtPayload(consent?.jwt).request_headers || [];
	const headerValue = (wanted: string): string => {
		const match = requestHeaders.find((header: any) => header?.name === wanted);
		return (match?.values?.[0] ?? '').trim();
	};
	const allowedOrEmpty = (value: string): string => (value && externalRedirectProblem(value) === null ? value : '');

	const rawTppRedirectUri = headerValue('TPP-Redirect-URI');
	const tppRedirectUri = allowedOrEmpty(rawTppRedirectUri);
	// Berlin Group: TPP-Nok-Redirect-URI replaces TPP-Redirect-URI for a negative result when it is sent.
	const rawNokRedirectUri = headerValue('TPP-Nok-Redirect-URI');
	const nokRedirectUri = rawNokRedirectUri ? allowedOrEmpty(rawNokRedirectUri) : tppRedirectUri;

	return {
		tppRedirectUri,
		nokRedirectUri,
		tppRedirectUriProblem: rawTppRedirectUri ? externalRedirectProblem(rawTppRedirectUri) : null
	};
}
