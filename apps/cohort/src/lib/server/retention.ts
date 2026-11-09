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
import { policyOf, type RetentionPolicy, type RetentionRun } from '$lib/retention';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

/** OBP-API's retention endpoints at Cohort's space, called with the staff member's own token and Roles. */
const base = () => `/obp/v7.0.0/management/banks/${encodeURIComponent(cohortSpace())}`;

export async function policies(token: string): Promise<RetentionPolicy[]> {
	const response = await obpRequests.get(`${base()}/retention-policies`, token);
	return ((response?.retention_policies ?? []) as Record<string, unknown>[]).map(policyOf);
}

export const createPolicy = (body: Record<string, unknown>, token: string) => obpRequests.post(`${base()}/retention-policies`, body, token);
export const updatePolicy = (id: string, body: Record<string, unknown>, token: string) => obpRequests.put(`${base()}/retention-policies/${encodeURIComponent(id)}`, body, token);
export const deletePolicy = (id: string, token: string) => obpRequests.delete(`${base()}/retention-policies/${encodeURIComponent(id)}`, token);

/** What a policy would archive, anonymise or delete now, without doing it. */
export async function preview(id: string, token: string): Promise<Record<string, unknown>> {
	return (await obpRequests.get(`${base()}/retention-policies/${encodeURIComponent(id)}/preview`, token)) ?? {};
}

/** Run a policy now: done at once, or waiting for a second person's approval when the policy asks for it. */
export const runPolicy = (id: string, token: string) => obpRequests.post(`${base()}/retention-policies/${encodeURIComponent(id)}/runs`, { mode: 'execute' }, token);

export async function runs(token: string): Promise<RetentionRun[]> {
	const response = await obpRequests.get(`${base()}/retention-runs?limit=50`, token);
	const n = (v: unknown) => (typeof v === 'number' ? v : 0);
	return ((response?.retention_runs ?? []) as Record<string, unknown>[]).map((r) => ({
		retention_run_id: String(r.retention_run_id ?? ''),
		retention_policy_id: String(r.retention_policy_id ?? ''),
		mode: String(r.mode ?? ''),
		status: String(r.status ?? ''),
		requested_by: String(r.requested_by_user_id ?? ''),
		approved_by: String(r.approved_by_user_id ?? ''),
		counts: Object.fromEntries(
			(['matched', 'archived', 'anonymised', 'deleted', 'held', 'failed'] as const).map((k) => [k, n(r[`${k}_count`])]).filter(([, v]) => v !== 0)
		),
		message: String(r.message ?? ''),
		created_at: String(r.requested_at ?? '')
	}));
}

export const decideRun = (id: string, approve: boolean, token: string) =>
	obpRequests.put(`${base()}/retention-runs/${encodeURIComponent(id)}/approval`, { decision: approve ? 'approve' : 'reject' }, token);
