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
import { decisionEmail } from '$lib/emails';
import { latestDecision, nowUtc, type Decision, type DecisionStage } from '$lib/screening';
import { requestApplicationAccessToken } from './applicationToken';
import { emailSettings } from './emailSettings';
import { CALL, SCREENING_DECISION } from './entities/definitions';
import { emailCustomer, pageUrl } from './notify';
import { createRecord, getRecord, listRecords, type CohortRecord } from './records';

const logger = createLogger('CohortDecisions');

/** Every screening decision, read as Cohort itself (its Get Scope). Empty, and logged, when it cannot be read. */
export async function decisionsAsCohort(): Promise<CohortRecord[]> {
	const { token } = await requestApplicationAccessToken();
	if (!token) return [];
	try {
		return await listRecords(SCREENING_DECISION, '', token);
	} catch (err) {
		logger.warn('Cohort could not read screening decisions (does it hold the Scope shown on /staff/setup?):', err);
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

/**
 * Record a staff decision on a submitted application (a new, append-only record, as the staff member) and email the
 * applicant's Customer the outcome and the message for them, never the reason. Throws when the decision cannot be
 * recorded; a failed email is only logged (by emailCustomer).
 */
export async function recordDecision(args: {
	applicationId: string;
	application: CohortRecord;
	stage: DecisionStage;
	decision: Decision;
	reason: string;
	message: string;
	username: string;
	siteName: string;
	token: string;
}): Promise<void> {
	const record: CohortRecord = {
		application_id: args.applicationId,
		call_id: String(args.application.call_id ?? ''),
		decision: args.decision,
		stage: args.stage,
		reason: args.reason.trim(),
		message_to_applicant: args.message.trim(),
		decided_by_username: args.username,
		decided_at: nowUtc()
	};
	await createRecord(SCREENING_DECISION, '', Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '')), args.token);
	if (!(await emailSettings()).decision) return;
	const call = await getRecord(CALL, 'public', String(args.application.call_id)).catch(() => null);
	await emailCustomer(
		String(args.application.customer_id ?? ''),
		decisionEmail({
			site: args.siteName,
			call: String(call?.title ?? ''),
			startup: String(args.application.startup_name ?? ''),
			link: pageUrl(`/applications/${args.applicationId}`),
			decision: args.decision,
			message: args.message.trim()
		}),
		`${SCREENING_DECISION}:${args.applicationId}`
	);
}
