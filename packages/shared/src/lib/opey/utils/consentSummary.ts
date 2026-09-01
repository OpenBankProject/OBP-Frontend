/**
 * Browser-side summary of the consents Opey has been granted in this chat.
 *
 * A consent is a frozen snapshot: OBP executes it as a shadow user holding
 * exactly the entitlements/views embedded in the JWT at mint time. Showing the
 * user what each granted consent actually embeds (next to "you gained a new
 * entitlement") makes it obvious why a fresh consent is needed after an
 * escalation. Everything here is derived from the JWT payload alone — no
 * network calls, no secrets beyond what the browser already holds.
 */

export interface ConsentEntitlement {
	role_name: string;
	/** Empty string for system-wide entitlements. */
	bank_id: string;
}

export interface ConsentView {
	bank_id: string;
	account_id: string;
	view_id: string;
}

export interface GrantedConsentSummary {
	/** OBP consent id (`jti`), falling back to the raw JWT so dedupe still works. */
	id: string;
	entitlements: ConsentEntitlement[];
	views: ConsentView[];
	/** Unix ms, or null when the JWT carries no `exp`. */
	expiresAt: number | null;
	/** Unix ms when the browser recorded the grant. */
	grantedAt: number;
	/**
	 * OBP's stable external `consent_reference_id` — the value the metrics
	 * dashboards filter on. Not a JWT claim, so it is resolved separately from
	 * the /my/consents listing and may be absent until that lookup completes.
	 */
	referenceId?: string;
}

function decodePayload(jwt: string): any | null {
	try {
		const seg = jwt.split('.')[1];
		if (!seg) return null;
		const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
		const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
		return JSON.parse(atob(padded));
	} catch {
		return null;
	}
}

/** Decode a consent JWT into a display summary. Returns null if it can't be decoded. */
export function summariseConsentJwt(jwt: string, now: number = Date.now()): GrantedConsentSummary | null {
	const payload = decodePayload(jwt);
	if (!payload || typeof payload !== 'object') return null;

	const entitlements: ConsentEntitlement[] = (Array.isArray(payload.entitlements) ? payload.entitlements : [])
		.filter((e: any) => e && typeof e.role_name === 'string')
		.map((e: any) => ({ role_name: e.role_name, bank_id: e.bank_id ?? '' }));

	const views: ConsentView[] = (Array.isArray(payload.views) ? payload.views : [])
		.filter((v: any) => v && typeof v === 'object')
		.map((v: any) => ({
			bank_id: v.bank_id ?? '',
			account_id: v.account_id ?? '',
			view_id: v.view_id ?? v.id ?? ''
		}));

	return {
		id: typeof payload.jti === 'string' && payload.jti ? payload.jti : jwt,
		entitlements,
		views,
		expiresAt: typeof payload.exp === 'number' ? payload.exp * 1000 : null,
		grantedAt: now
	};
}

/** Append a consent, replacing any earlier record with the same id (reuse returns the same JWT). */
export function addGrantedConsent(
	list: GrantedConsentSummary[],
	summary: GrantedConsentSummary
): GrantedConsentSummary[] {
	return [...list.filter((c) => c.id !== summary.id), summary];
}

/** Attach a resolved consent_reference_id to the consent with this id. */
export function setConsentReferenceId(
	list: GrantedConsentSummary[],
	id: string,
	referenceId: string
): GrantedConsentSummary[] {
	return list.map((c) => (c.id === id ? { ...c, referenceId } : c));
}

/** Consents whose JWT has not expired (unknown expiry counts as active). */
export function activeConsents(list: GrantedConsentSummary[], now: number = Date.now()): GrantedConsentSummary[] {
	return list.filter((c) => c.expiresAt === null || c.expiresAt > now);
}

/**
 * Does any consent embed this (role, bank) pair? A system-wide embedded
 * entitlement (empty bank_id) covers the role at every bank, mirroring OBP.
 */
export function consentsCover(list: GrantedConsentSummary[], wanted: ConsentEntitlement): boolean {
	return list.some((c) =>
		c.entitlements.some(
			(e) => e.role_name === wanted.role_name && (e.bank_id === '' || e.bank_id === wanted.bank_id)
		)
	);
}
