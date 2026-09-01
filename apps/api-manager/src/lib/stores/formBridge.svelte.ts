/**
 * Bridge between a form on the current page and an embedded Opey chat.
 *
 * The form registers itself on mount (and unregisters on destroy); the page's
 * Opey client-tool handler calls `apply()` when Opey wants to fill fields.
 * Same module-level pattern as pageDataSummary, but inbound: chat → page.
 */

export interface FormDraftResult {
	/** Field names that were actually written into the form. */
	applied: string[];
	/** Keys the form does not know — echoed back so Opey can self-correct. */
	ignored: string[];
}

export interface FormBridgeTarget {
	/** Human/model-readable name of the form, e.g. "create-dynamic-resource-doc". */
	formName: string;
	/** Write the given fields into the form; must never submit. */
	applyDraft(fields: Record<string, unknown>): FormDraftResult;
	/** Model-facing description: field names, types, constraints, current values. */
	describe(): string;
}

let target = $state<FormBridgeTarget | null>(null);

export const formBridge = {
	get target(): FormBridgeTarget | null {
		return target;
	},
	register(t: FormBridgeTarget): void {
		target = t;
	},
	unregister(t: FormBridgeTarget): void {
		if (target === t) target = null;
	},
	/** Throws when no form is registered — the caller reports it back to Opey as an error. */
	apply(fields: Record<string, unknown>): FormDraftResult {
		if (!target) throw new Error('No form on this page is accepting drafts');
		return target.applyDraft(fields);
	},
	describe(): string {
		return target?.describe() ?? '';
	}
};
