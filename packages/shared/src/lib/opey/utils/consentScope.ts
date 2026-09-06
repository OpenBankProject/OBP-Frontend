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
/**
 * Shared sessionStorage-backed "working set" of accounts/views the user has chosen
 * to operate on in this tab. Written by the shared AccountScopePicker component and read
 * by the consent grant flow so the resulting Consent-JWT includes the right view grants
 * for view-based endpoints.
 */

export interface ConsentViewSelection {
	bank_id: string;
	account_id: string;
	view_id: string;
}

const STORAGE_KEY = 'obp_opey_selected_views';

function hasSessionStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function getSelectedConsentViews(): ConsentViewSelection[] {
	if (!hasSessionStorage()) return [];
	const raw = window.sessionStorage.getItem(STORAGE_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(v): v is ConsentViewSelection =>
				v && typeof v.bank_id === 'string' && typeof v.account_id === 'string' && typeof v.view_id === 'string'
		);
	} catch {
		return [];
	}
}

export function setSelectedConsentViews(views: ConsentViewSelection[]): void {
	if (!hasSessionStorage()) return;
	window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(views));
	// Notify same-tab listeners (storage events only fire cross-tab).
	window.dispatchEvent(new CustomEvent('obp:consent-scope-changed'));
}

export function clearSelectedConsentViews(): void {
	if (!hasSessionStorage()) return;
	window.sessionStorage.removeItem(STORAGE_KEY);
	window.dispatchEvent(new CustomEvent('obp:consent-scope-changed'));
}
