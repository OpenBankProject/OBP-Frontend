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
import { idOf, listRecords, type EntityRecord } from './records';
import { APPROVAL, PARTICIPANT, REPORT, REVIEW_ASSIGNMENT, RUN, SUBMISSION, SUITE, SYSTEM } from './entities/definitions';
import { setupStatus } from './setupStatus';
import { reportSigner } from './reports';
import { isStaffRole, roleCheck, staffAccess } from './staffAccess';
import { centralSpace, runnerConsumerId } from './space';
import { entitlementRequestsUrl, platformAppsUrl } from './appDirectory';
import { obpRequests } from './obp';
import { mySpaces } from './spaces';
import { submissionStatus } from '$lib/review';
import type { AdminFacts, ParticipantFacts, RegulatorFacts } from '$lib/gettingStarted';

const count = (list: unknown[] | null) => (list === null ? null : list.length);

type SetupStatus = Awaited<ReturnType<typeof setupStatus>>;

/** What the setup page checks, or null when OBP-API could not be asked. */
export async function readSetup(): Promise<SetupStatus | null> {
	return setupStatus().catch(() => null);
}

/** Whether Conformator is ready to use: every piece the administrator's steps set up. */
export function setupDone(s: SetupStatus | null): boolean | null {
	if (!s || s.spaceExists === null || s.state === 'unknown') return null;
	return s.spaceExists && s.state === 'ok' && s.entities.every((e) => e.ok === true) && s.runnerConsumerId !== null && reportSigner().signer !== null;
}

/** Staff Role requests waiting for an administrator, or null when the User may not read everyone's requests. */
async function waitingStaffRoleRequests(token: string): Promise<number | null> {
	try {
		const answer = await obpRequests.get('/obp/v5.1.0/entitlement-requests', token);
		const requests: Array<{ role_name: string }> = answer?.entitlement_requests ?? [];
		return requests.filter((r) => isStaffRole(r.role_name)).length;
	} catch {
		return null;
	}
}

/** What the administrator's steps need. */
export async function adminFacts(token: string | undefined, s: SetupStatus | null): Promise<AdminFacts> {
	const manager = s?.apiManagerUrl ?? null;
	const runner = runnerConsumerId();
	return {
		space: centralSpace(),
		spaceExists: s?.spaceExists ?? null,
		appScopesHeld: !s || s.state === 'unknown' ? null : s.state === 'ok',
		entitiesReady: !s || s.entities.some((e) => e.ok === null) ? null : s.entities.every((e) => e.ok === true),
		runnerConsumerIdSet: Boolean(runner),
		signingKeyReady: reportSigner().signer !== null,
		waitingRoleRequests: token ? await waitingStaffRoleRequests(token) : null,
		links: {
			createBank: s?.createBankUrl ?? null,
			appPlatformApps: s?.platformAppsUrl ?? null,
			runnerPlatformApps: manager && runner ? platformAppsUrl(manager, runner, 'OBP-Conformator-Runner') : null,
			roleRequests: manager ? entitlementRequestsUrl(manager) : null
		}
	};
}

/** What the regulator's steps need. Each fact is null when it cannot be read. */
export async function regulatorFacts(token: string | undefined): Promise<RegulatorFacts> {
	const [suites, reports] = await Promise.all([
		listRecords(SUITE, undefined, { access: 'public' }).then((l) => l.map((r) => r.record)).catch(() => null),
		listRecords(REPORT, undefined, { access: 'public' }).catch(() => null)
	]);
	let staffRolesHeld: number | null = null;
	let staffRolesTotal = 0;
	let participants: number | null = null;
	if (token) {
		const [access, can] = await Promise.all([staffAccess(token).catch(() => null), roleCheck(token).catch(() => null)]);
		if (access) {
			staffRolesHeld = access.roles.filter((r) => r.held).length;
			staffRolesTotal = access.roles.length;
		}
		if (can?.(`CanGetDynamicEntityRecord_${PARTICIPANT}`)) participants = count(await listRecords(PARTICIPANT, token).catch(() => null));
	}
	return {
		loggedIn: Boolean(token),
		staffRolesHeld,
		staffRolesTotal,
		suites: count(suites),
		approvedSuites: suites === null ? null : suites.filter((s) => s.status === 'approved').length,
		participants,
		reports: count(reports)
	};
}

/** What a participant's steps need, added up over every space the User belongs to. */
export async function participantFacts(token: string | undefined): Promise<ParticipantFacts> {
	const none: ParticipantFacts = { loggedIn: Boolean(token), spaces: null, systems: null, runs: null, submissions: null, approvedSubmissions: null };
	if (!token) return none;
	const spaces = await mySpaces(token).catch(() => null);
	if (spaces === null) return none;
	const perSpace = await Promise.all(
		spaces.map(async ({ id: spaceId }) => {
			const [systems, runs, submissions, approvals, assignments] = await Promise.all([
				listRecords(SYSTEM, token, { space: spaceId }).catch(() => null),
				listRecords(RUN, token, { space: spaceId }).catch(() => null),
				listRecords(SUBMISSION, token, { space: spaceId }).catch(() => null),
				listRecords(APPROVAL, token, { space: spaceId }).catch(() => []),
				listRecords(REVIEW_ASSIGNMENT, token, { space: spaceId }).catch(() => [])
			]);
			const of = (list: typeof approvals, submissionId: string) =>
				list.map((r): EntityRecord => ({ ...r.record, created_at: r.metadata.created?.at ?? '' })).filter((r) => r.submission_id === submissionId);
			const approved =
				submissions === null
					? null
					: submissions.filter(({ record }) => {
							const submissionId = idOf(SUBMISSION, record);
							return submissionStatus(of(approvals, submissionId), of(assignments, submissionId)) === 'approved';
						}).length;
			return { systems: count(systems), runs: count(runs), submissions: count(submissions), approved };
		})
	);
	// A total is known only when every space could be read.
	const total = (pick: (s: (typeof perSpace)[number]) => number | null) =>
		perSpace.some((s) => pick(s) === null) ? null : perSpace.reduce((sum, s) => sum + (pick(s) ?? 0), 0);
	return {
		loggedIn: true,
		spaces,
		systems: total((s) => s.systems),
		runs: total((s) => s.runs),
		submissions: total((s) => s.submissions),
		approvedSubmissions: total((s) => s.approved)
	};
}
