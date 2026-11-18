/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { createRecord, idOf, listRecords, type EntityRecord } from './records';
import { PARTICIPANT, RUN, SYSTEM } from './entities/definitions';
import { roleCheck } from './staffAccess';


/**
 * Reference runs: a suite run against the OBP sandbox itself (or the mock of a loaded OpenAPI file), before
 * participants use it. A test that fails against the reference is more likely wrong than the reference. The reference
 * is a participant marked is_reference, with a system for each role it plays; everything else is an ordinary run.
 */

export interface ReferenceStatus {
	/** Why there is no reference to run against, or null. */
	missing: string | null;
	space: string | null;
	system: { id: string; name: string; base_url: string } | null;
	latest: { id: string; status: string; created_at: string } | null;
	canStart: boolean;
	startRole: string;
}

/**
 * The reference system for a suite: in the first reference participant's space, a system of the role the suite tests,
 * preferring one whose API profile names the suite's source (its OBP API version or its dynamic endpoint set).
 */
export async function referenceStatus(suite: EntityRecord, token: string): Promise<ReferenceStatus> {
	const startRole = `CanCreateDynamicEntityRecord_${RUN}`;
	const empty = (missing: string): ReferenceStatus => ({ missing, space: null, system: null, latest: null, canStart: false, startRole });
	const participants = await listRecords(PARTICIPANT, token).catch(() => null);
	if (!participants) return empty('The participant register cannot be read, so the reference cannot be found.');
	const reference = participants.map((p) => p.record).find((p) => p.is_reference === true);
	if (!reference) return empty('No participant is marked as the reference. Register the OBP sandbox as one, set up its space, and add its systems.');
	const space = String(reference.space_id);
	const systems = await listRecords(SYSTEM, token, { space }).then((l) => l.map((r) => r.record)).catch(() => null);
	if (!systems) return { ...empty(`The reference's systems in ${space} cannot be read.`), space };
	const ofRole = systems.filter((s) => s.system_role === suite.system_role);
	const profile = String(suite.obp_api_version || suite.dynamic_endpoint_id || '');
	const system = ofRole.find((s) => profile && s.api_profile === profile) ?? ofRole[0];
	if (!system) return { ...empty(`The reference has no system that is an ${String(suite.system_role).replaceAll('_', ' ')}.`), space };
	const runs = await listRecords(RUN, token, { space })
		.then((l) => l.filter((r) => r.record.suite_id === idOf('conformator_suite', suite)).map(({ record, metadata }): EntityRecord => ({ ...record, created_at: metadata.created?.at ?? '' })))
		.catch(() => []);
	const latest = runs.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
	const can = await roleCheck(token);
	return {
		missing: null,
		space,
		system: { id: idOf(SYSTEM, system), name: String(system.name), base_url: String(system.base_url) },
		latest: latest ? { id: idOf(RUN, latest), status: String(latest.status), created_at: String(latest.created_at) } : null,
		canStart: can(startRole, space),
		startRole
	};
}

/** Queue a run of the suite against the reference system. */
export async function startReferenceRun(suite: EntityRecord, token: string): Promise<{ space: string; runId: string }> {
	const status = await referenceStatus(suite, token);
	if (status.missing || !status.space || !status.system) throw new Error(status.missing ?? 'There is no reference to run against.');
	const run = await createRecord(
		RUN,
		{ system_id: status.system.id, suite_id: idOf('conformator_suite', suite), trigger: 'reference', status: 'queued' },
		token,
		{ space: status.space }
	);
	return { space: status.space, runId: idOf(RUN, run) };
}

