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
 * Retention of Cohort's records, kept by OBP-API: a policy per kind of record says how long it stays live, whether
 * it is then archived (read-only, out of Cohort, for the rest of the official period) and when it is deleted. Periods
 * are configuration: the official schedule sets them. Nothing is restored from the archive.
 */

export const RESOURCE_TYPES = ['dynamic_entity_record', 'file', 'chat_message', 'chat_room', 'customer', 'consent'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const RETENTION_ACTIONS = ['archive', 'delete', 'anonymise'] as const;
export type RetentionAction = (typeof RETENTION_ACTIONS)[number];

export interface RetentionPolicy {
	retention_policy_id: string;
	bank_id: string;
	resource_type: ResourceType;
	entity_name: string;
	date_basis: string;
	condition: string;
	retain_days: number;
	archive_days: number | null;
	action: RetentionAction;
	cascade: boolean;
	requires_approval: boolean;
	enabled: boolean;
}

export interface RetentionRun {
	retention_run_id: string;
	retention_policy_id: string;
	mode: string;
	status: string;
	requested_by: string;
	approved_by: string;
	counts: Record<string, number>;
	message: string;
	created_at: string;
}

/** A suggested policy for one kind of Cohort record: staff start from it and set the official periods. */
export interface Suggestion {
	key: string;
	resource_type: ResourceType;
	entity_name: string;
	date_basis: string;
	condition: string;
	retain_days: number;
	archive_days: number | null;
	action: RetentionAction;
	cascade: boolean;
}

/**
 * Starting points, to be set to the official retention schedule. Deleting always needs approval. None is shorter than
 * five years, the default of OBP-API's retention.minimum_retain_days, below which OBP-API refuses a policy.
 */
export const SUGGESTIONS: Suggestion[] = [
	{ key: 'drafts', resource_type: 'dynamic_entity_record', entity_name: 'cohort_application', date_basis: 'updated', condition: 'status=draft', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: true },
	{ key: 'applications', resource_type: 'dynamic_entity_record', entity_name: 'cohort_application', date_basis: 'field:submitted_at', condition: 'status=submitted', retain_days: 5 * 365, archive_days: 2 * 365, action: 'archive', cascade: true },
	{ key: 'decisions', resource_type: 'dynamic_entity_record', entity_name: 'cohort_screening_decision', date_basis: 'field:decided_at', condition: '', retain_days: 5 * 365, archive_days: 2 * 365, action: 'archive', cascade: false },
	{ key: 'reviews', resource_type: 'dynamic_entity_record', entity_name: 'cohort_review', date_basis: 'created', condition: '', retain_days: 5 * 365, archive_days: 2 * 365, action: 'archive', cascade: false },
	{ key: 'opey', resource_type: 'dynamic_entity_record', entity_name: 'cohort_opey_conversation', date_basis: 'updated', condition: '', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: false },
	{ key: 'reminders', resource_type: 'dynamic_entity_record', entity_name: 'cohort_reminder', date_basis: 'created', condition: '', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: false },
	{ key: 'bookmarks', resource_type: 'dynamic_entity_record', entity_name: 'cohort_bookmark', date_basis: 'created', condition: '', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: false },
	{ key: 'chat', resource_type: 'chat_message', entity_name: '', date_basis: 'created', condition: '', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: false },
	{ key: 'customers', resource_type: 'customer', entity_name: '', date_basis: 'updated', condition: '', retain_days: 7 * 365, archive_days: null, action: 'anonymise', cascade: true },
	{ key: 'consents', resource_type: 'consent', entity_name: '', date_basis: 'expires', condition: '', retain_days: 5 * 365, archive_days: null, action: 'delete', cascade: false }
];

/** OBP-API's condition, {field, value}, as the form shows it: field=value. */
function conditionText(c: unknown): string {
	if (!c || typeof c !== 'object') return '';
	const { field, value } = c as Record<string, unknown>;
	return field ? `${String(field)}=${String(value ?? '')}` : '';
}

/** The form's field=value as OBP-API's condition; an empty field removes it. */
export function conditionOf(text: string): { field: string; value: string } | null {
	const at = text.indexOf('=');
	if (at < 1) return null;
	return { field: text.slice(0, at).trim(), value: text.slice(at + 1).trim() };
}

/** A policy from OBP-API's JSON, read carefully. */
export function policyOf(r: Record<string, unknown>): RetentionPolicy {
	const n = (v: unknown, fallback: number | null) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
	const type = String(r.resource_type ?? '');
	const action = String(r.action ?? '');
	return {
		retention_policy_id: String(r.retention_policy_id ?? ''),
		bank_id: String(r.bank_id ?? ''),
		resource_type: (RESOURCE_TYPES as readonly string[]).includes(type) ? (type as ResourceType) : 'dynamic_entity_record',
		entity_name: String(r.entity_name ?? ''),
		date_basis: String(r.date_basis ?? 'created'),
		condition: conditionText(r.condition),
		retain_days: n(r.retain_days, 0) as number,
		archive_days: n(r.archive_days, null),
		action: (RETENTION_ACTIONS as readonly string[]).includes(action) ? (action as RetentionAction) : 'archive',
		cascade: r.cascade === true,
		requires_approval: r.requires_approval === true,
		enabled: r.enabled === true
	};
}

/**
 * The policy's JSON for OBP-API, from the policy form. Deleting and anonymising are always approved first. Archiving
 * needs the days in the archive. On a change (`existing`), what the policy is about cannot change, so it is left out.
 */
export function policyBody(form: FormData, existing = false): Record<string, unknown> | null {
	const s = (k: string) => String(form.get(k) ?? '').trim();
	const days = (k: string) => (s(k) === '' ? null : Number.parseInt(s(k), 10));
	const type = s('resource_type');
	const action = s('action');
	const retain = days('retain_days');
	const archive = days('archive_days');
	if (!(RESOURCE_TYPES as readonly string[]).includes(type) || !(RETENTION_ACTIONS as readonly string[]).includes(action)) return null;
	if (retain === null || !Number.isInteger(retain) || retain < 1) return null;
	if (archive !== null && (!Number.isInteger(archive) || archive < 1)) return null;
	if (type === 'dynamic_entity_record' && !s('entity_name')) return null;
	if (action === 'anonymise' && type !== 'customer') return null;
	if (action === 'archive' && archive === null) return null;
	const condition = conditionOf(s('condition'));
	if (s('condition') && !condition) return null;
	return {
		...(existing ? {} : { resource_type: type, ...(type === 'dynamic_entity_record' ? { entity_name: s('entity_name') } : {}) }),
		date_basis: s('date_basis') || 'created',
		...(condition ? { condition } : existing ? { condition: { field: '', value: '' } } : {}),
		retain_days: retain,
		...(archive !== null && action === 'archive' ? { archive_days: archive } : {}),
		action,
		cascade: form.get('cascade') === 'on',
		requires_approval: action !== 'archive' || form.get('requires_approval') === 'on',
		enabled: form.get('enabled') === 'on'
	};
}
