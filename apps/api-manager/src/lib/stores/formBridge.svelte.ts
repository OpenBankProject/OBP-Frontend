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
