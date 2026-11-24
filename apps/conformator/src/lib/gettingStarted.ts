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

/**
 * The steps of the Prepare Conformator for Use page (/prepare), for the administrator, the regulator's staff and participants. Each step says what to do, why,
 * and where; its status comes from what OBP-API holds. A fact is null when it is not known (the User is not logged
 * in, or lacks the Role to read it), so a step is never shown as done without knowing.
 */
import { counted, formatList, formatNumber, m } from '@obp/shared/i18n';

export type Track = 'admin' | 'regulator' | 'participant';
export type StepStatus = 'done' | 'next' | 'todo';

export interface Step {
	key: string;
	title: string;
	what: string;
	/** Who does it, or the Roles it needs. */
	who: string;
	href: string;
	action: string;
	/** A quicker way to try it out, such as the example suite. */
	shortcut?: { href: string; label: string };
	/** Progress so far, such as "You hold 9 of 14 staff Roles." */
	progress?: string;
	status: StepStatus;
}

export interface AdminFacts {
	space: string;
	spaceExists: boolean | null;
	/** Whether Conformator's Consumer holds every Scope it needs. */
	appScopesHeld: boolean | null;
	/** Whether Conformator has created all its records' definitions (dynamic entities) in the central space. */
	entitiesReady: boolean | null;
	runnerConsumerIdSet: boolean;
	signingKeyReady: boolean;
	/** Staff Role requests waiting for an administrator; null when the User cannot read them. */
	waitingRoleRequests: number | null;
	links: { createBank: string | null; appPlatformApps: string | null; runnerPlatformApps: string | null; roleRequests: string | null };
}

export interface RegulatorFacts {
	loggedIn: boolean;
	staffRolesHeld: number | null;
	staffRolesTotal: number;
	suites: number | null;
	approvedSuites: number | null;
	participants: number | null;
	reports: number | null;
}

export interface ParticipantFacts {
	loggedIn: boolean;
	/** The participant spaces the User belongs to. */
	spaces: Array<{ id: string; name: string }> | null;
	systems: number | null;
	runs: number | null;
	submissions: number | null;
	approvedSubmissions: number | null;
}

type Draft = Omit<Step, 'status'> & { done: boolean };

/** Marks the first step not yet done as the next one. */
export function withNext(drafts: Draft[]): Step[] {
	const next = drafts.findIndex((d) => !d.done);
	return drafts.map(({ done, ...step }, i) => ({ ...step, status: done ? 'done' : i === next ? 'next' : 'todo' }));
}

const some = (n: number | null) => n !== null && n > 0;

// Every text below is a message, so the steps come out in the page's language (see packages/shared/messages).

export function adminSteps(f: AdminFacts): Step[] {
	return withNext([
		{
			key: 'space',
			title: m.conformator_step_space_title(),
			what: m.conformator_step_space_what({ space: f.space }),
			who: m.conformator_step_who_admin_manager(),
			href: f.links.createBank ?? '/setup#space',
			action: f.links.createBank ? m.conformator_step_space_action() : m.conformator_step_see_on_setup(),
			progress: f.spaceExists === null ? undefined : f.spaceExists ? m.conformator_step_space_exists({ space: f.space }) : m.conformator_step_space_missing({ space: f.space }),
			done: f.spaceExists === true
		},
		{
			key: 'app',
			title: m.conformator_step_app_title(),
			what: m.conformator_step_app_what(),
			who: m.conformator_step_who_admin_manager(),
			href: f.links.appPlatformApps ?? '/setup#platform-app',
			action: f.links.appPlatformApps ? m.conformator_step_app_action() : m.conformator_step_see_on_setup(),
			progress:
				f.appScopesHeld === null
					? undefined
					: !f.appScopesHeld
						? m.conformator_step_app_missing()
						: f.entitiesReady
							? m.conformator_step_app_ready()
							: m.conformator_step_app_not_ready(),
			done: f.appScopesHeld === true && f.entitiesReady === true
		},
		{
			key: 'runner',
			title: m.conformator_step_runner_title(),
			what: m.conformator_step_runner_what(),
			who: m.conformator_step_runner_who(),
			href: f.links.runnerPlatformApps ?? '/setup#runner',
			action: f.links.runnerPlatformApps ? m.conformator_step_runner_action() : m.conformator_step_see_on_setup(),
			progress: f.runnerConsumerIdSet ? m.conformator_step_runner_set() : m.conformator_step_runner_unset(),
			done: f.runnerConsumerIdSet
		},
		{
			key: 'signing',
			title: m.conformator_step_signing_title(),
			what: m.conformator_step_signing_what(),
			who: m.conformator_step_signing_who(),
			href: '/setup#signing',
			action: m.conformator_step_signing_action(),
			progress: f.signingKeyReady ? m.conformator_step_signing_ready() : m.conformator_step_signing_missing(),
			done: f.signingKeyReady
		},
		{
			key: 'staff',
			title: m.conformator_step_staff_title(),
			what: m.conformator_step_staff_what(),
			who: m.conformator_step_who_admin_manager(),
			href: f.links.roleRequests ?? '/setup#roles',
			action: f.links.roleRequests ? m.conformator_step_staff_action_requests() : m.conformator_step_staff_action_setup(),
			progress:
				f.waitingRoleRequests === null
					? undefined
					: f.waitingRoleRequests
						? m.conformator_step_staff_waiting(counted(f.waitingRoleRequests))
						: m.conformator_step_staff_none_waiting(),
			done: f.waitingRoleRequests === 0
		}
	]);
}

export function regulatorSteps(f: RegulatorFacts): Step[] {
	const rolesDone = f.staffRolesHeld !== null && f.staffRolesHeld >= f.staffRolesTotal;
	return withNext([
		{
			key: 'roles',
			title: m.conformator_step_roles_title(),
			what: m.conformator_step_roles_what(),
			who: m.conformator_step_roles_who(),
			href: '/staff/access',
			action: m.conformator_step_roles_action(),
			progress:
				f.staffRolesHeld === null ? undefined : m.conformator_step_roles_held({ held: formatNumber(f.staffRolesHeld), total: formatNumber(f.staffRolesTotal) }),
			done: rolesDone
		},
		{
			key: 'catalogue',
			title: m.conformator_build_catalogue(),
			what: m.conformator_step_catalogue_what(),
			who: m.conformator_step_catalogue_who(),
			href: '/staff/suites',
			action: m.conformator_step_catalogue_action(),
			shortcut: { href: '/staff/example-data', label: m.conformator_step_catalogue_example() },
			progress: f.suites === null ? undefined : f.suites ? m.conformator_step_catalogue_suites(counted(f.suites)) : m.conformator_no_suites_yet(),
			done: some(f.suites)
		},
		{
			key: 'approve',
			title: m.conformator_step_approve_title(),
			what: m.conformator_step_approve_what(),
			who: m.conformator_step_approve_who(),
			href: '/staff/suites',
			action: m.conformator_step_approve_title(),
			progress: f.approvedSuites === null ? undefined : f.approvedSuites ? m.conformator_step_approve_count(counted(f.approvedSuites)) : m.conformator_step_approve_none(),
			done: some(f.approvedSuites)
		},
		{
			key: 'participant',
			title: m.conformator_step_participant_title(),
			what: m.conformator_step_participant_what(),
			who: m.conformator_step_participant_who(),
			href: '/staff/participants',
			action: m.conformator_step_participant_action(),
			progress:
				f.participants === null ? undefined : f.participants ? m.conformator_step_participant_count(counted(f.participants)) : m.conformator_step_participant_none(),
			done: some(f.participants)
		},
		{
			key: 'review',
			title: m.conformator_step_review_title(),
			what: m.conformator_step_review_what(),
			who: m.conformator_step_review_who(),
			href: '/reviews',
			action: m.conformator_step_review_action(),
			progress: f.reports === null ? undefined : f.reports ? m.conformator_step_review_count(counted(f.reports)) : m.conformator_step_review_none(),
			done: some(f.reports)
		}
	]);
}

export function participantSteps(f: ParticipantFacts): Step[] {
	const spaces = f.spaces ?? [];
	// With one space, the steps go straight to it; with several, the User chooses.
	const spaceHref = spaces.length === 1 ? `/spaces/${encodeURIComponent(spaces[0].id)}` : '/spaces';
	return withNext([
		{
			key: 'login',
			title: m.conformator_step_login_title(),
			what: m.conformator_step_login_what(),
			who: m.conformator_step_login_who(),
			// Back to this page's participant steps after logging in
			href: '/login?return_to=%2Fprepare%3Ffor%3Dparticipant',
			action: m.conformator_step_login_title(),
			progress: f.loggedIn ? m.conformator_step_login_done() : undefined,
			done: f.loggedIn
		},
		{
			key: 'space',
			title: m.conformator_step_join_title(),
			what: m.conformator_step_join_what(),
			who: m.conformator_step_join_who(),
			href: '/spaces',
			action: m.conformator_step_join_action(),
			progress:
				f.spaces === null
					? undefined
					: spaces.length
						? m.conformator_step_join_member({ names: formatList(spaces.map((s) => s.name)) })
						: m.conformator_step_join_none(),
			done: spaces.length > 0
		},
		{
			key: 'system',
			title: m.conformator_step_system_title(),
			what: m.conformator_step_system_what(),
			who: m.conformator_step_team(),
			href: spaceHref,
			action: m.conformator_step_system_action(),
			progress: f.systems === null ? undefined : f.systems ? m.conformator_step_system_count(counted(f.systems)) : m.conformator_step_system_none(),
			done: some(f.systems)
		},
		{
			key: 'run',
			title: m.conformator_step_run_title(),
			what: m.conformator_step_run_what(),
			who: m.conformator_step_team(),
			href: spaceHref,
			action: m.conformator_step_run_action(),
			shortcut: { href: '/catalogue', label: m.conformator_step_run_see_suites() },
			progress: f.runs === null ? undefined : f.runs ? m.conformator_step_run_count(counted(f.runs)) : m.conformator_step_run_none(),
			done: some(f.runs)
		},
		{
			key: 'submit',
			title: m.conformator_step_submit_title(),
			what: m.conformator_step_submit_what(),
			who: m.conformator_step_team(),
			href: spaceHref,
			action: m.conformator_step_submit_action(),
			progress: f.submissions === null ? undefined : f.submissions ? m.conformator_step_submit_count(counted(f.submissions)) : m.conformator_step_submit_none(),
			done: some(f.submissions)
		},
		{
			key: 'report',
			title: m.conformator_step_report_title(),
			what: m.conformator_step_report_what(),
			who: m.conformator_step_report_who(),
			href: '/reports',
			action: m.conformator_nav_reports(),
			progress:
				f.approvedSubmissions === null ? undefined : f.approvedSubmissions ? m.conformator_step_report_count(counted(f.approvedSubmissions)) : m.conformator_step_report_none(),
			done: some(f.approvedSubmissions)
		}
	]);
}

/** Which track to show first: the administrator's until Conformator is set up, then the regulator's for staff, else the participant's. */
export function defaultTrack(isStaff: boolean, setupDone: boolean | null): Track {
	if (setupDone !== true) return 'admin';
	return isStaff ? 'regulator' : 'participant';
}
