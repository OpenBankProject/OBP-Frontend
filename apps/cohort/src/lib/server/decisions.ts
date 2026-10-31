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
import { createLogger } from '@obp/shared/utils';
import { latestDecision } from '$lib/screening';
import { requestApplicationAccessToken } from './applicationToken';
import { SCREENING_DECISION } from './entities/definitions';
import { listRecords, type CohortRecord } from './records';

const logger = createLogger('CohortDecisions');

/** Every screening decision, read as Cohort itself (its Get Scope). Empty, and logged, when it cannot be read. */
export async function decisionsAsCohort(): Promise<CohortRecord[]> {
	const { token } = await requestApplicationAccessToken();
	if (!token) return [];
	try {
		return await listRecords(SCREENING_DECISION, '', token);
	} catch (err) {
		logger.warn('Cohort could not read screening decisions (does it hold the Scope shown on /setup?):', err);
		return [];
	}
}

/** What an applicant is told about a decision: never the internal reason. */
export function forApplicant(decision: CohortRecord | undefined) {
	return decision
		? {
				decision: String(decision.decision ?? ''),
				message: String(decision.message_to_applicant ?? ''),
				decided_at: String(decision.decided_at ?? '')
			}
		: null;
}

/** The applicant's view of the current outcome of each of these applications, by application id. */
export async function outcomesForApplicant(applicationIds: string[]) {
	const all = await decisionsAsCohort();
	return Object.fromEntries(applicationIds.map((id) => [id, forApplicant(latestDecision(id, all))]));
}
