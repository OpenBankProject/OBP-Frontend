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
