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
 * The applicant's form: its fields, how they are read from a submitted form, what must be filled in before
 * submitting, and the eligibility check. The field keys are the cohort_application entity's properties.
 */

export type FieldKind = 'text' | 'textarea' | 'select' | 'integer' | 'checkbox';

export interface ApplicationField {
	key: string;
	kind: FieldKind;
	options?: string[];
	/** Must be filled in before the application can be submitted. */
	requiredToSubmit?: boolean;
}

export const STAGES = ['idea', 'mvp', 'early_revenue', 'growth'];

export const APPLICATION_FIELDS: ApplicationField[] = [
	{ key: 'startup_name', kind: 'text', requiredToSubmit: true },
	{ key: 'sector', kind: 'text', requiredToSubmit: true },
	{ key: 'stage', kind: 'select', options: STAGES, requiredToSubmit: true },
	{ key: 'website', kind: 'text' },
	{ key: 'team_size', kind: 'integer' },
	{ key: 'problem_statement', kind: 'textarea', requiredToSubmit: true },
	{ key: 'solution', kind: 'textarea', requiredToSubmit: true },
	{ key: 'market_understanding', kind: 'textarea', requiredToSubmit: true },
	{ key: 'local_resident', kind: 'checkbox' },
	{ key: 'incorporated_locally', kind: 'checkbox' }
];

export type ApplicationValues = Record<string, string | number | boolean>;

/** The applicant's answers from a submitted form. Empty text fields and an unreadable number are left out. */
export function readApplicationForm(form: FormData): ApplicationValues {
	const values: ApplicationValues = {};
	for (const field of APPLICATION_FIELDS) {
		const raw = form.get(field.key);
		if (field.kind === 'checkbox') {
			values[field.key] = raw === 'on' || raw === 'true';
		} else if (field.kind === 'integer') {
			const n = Number.parseInt(String(raw ?? ''), 10);
			if (Number.isFinite(n) && n >= 0) values[field.key] = n;
		} else {
			const text = String(raw ?? '').trim();
			if (text && (!field.options || field.options.includes(text))) values[field.key] = text;
		}
	}
	return values;
}

/** The fields still to fill in before the application can be submitted. */
export function missingToSubmit(values: Record<string, unknown>): string[] {
	return APPLICATION_FIELDS.filter((f) => f.requiredToSubmit)
		.map((f) => f.key)
		.filter((key) => values[key] === undefined || values[key] === null || String(values[key]).trim() === '');
}

/**
 * Who may join: a citizen or resident of the programme's country, or a business incorporated there. Anyone else is not refused
 * but goes to a screener, who decides.
 */
export function eligibilityOf(values: Record<string, unknown>): 'eligible' | 'needs_review' {
	return values.local_resident === true || values.incorporated_locally === true ? 'eligible' : 'needs_review';
}

export function isCallOpen(call: Record<string, unknown>, today = new Date().toISOString().slice(0, 10)): boolean {
	if (call.status !== 'open') return false;
	const opens = typeof call.opens_at === 'string' ? call.opens_at : '';
	const closes = typeof call.closes_at === 'string' ? call.closes_at : '';
	return (!opens || opens <= today) && (!closes || today <= closes);
}
