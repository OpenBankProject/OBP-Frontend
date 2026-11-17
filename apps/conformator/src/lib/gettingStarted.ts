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
 * The steps of the Getting started page, for the administrator, the regulator's staff and participants. Each step says what to do, why,
 * and where; its status comes from what OBP-API holds. A fact is null when it is not known (the User is not logged
 * in, or lacks the Role to read it), so a step is never shown as done without knowing.
 */

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
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function adminSteps(f: AdminFacts): Step[] {
	return withNext([
		{
			key: 'space',
			title: 'Create the central space',
			what: `The central space is a bank in OBP-API, with the bank_id ${f.space}. It holds the test catalogue, the participant register and the issued reports. Staff Roles are granted there, so they reach nothing else in OBP-API.`,
			who: 'An administrator, in the API Manager.',
			href: f.links.createBank ?? '/setup#space',
			action: f.links.createBank ? 'Create it in the API Manager' : 'See it on the setup page',
			progress: f.spaceExists === null ? undefined : f.spaceExists ? `The bank ${f.space} exists.` : `The bank ${f.space} does not exist yet.`,
			done: f.spaceExists === true
		},
		{
			key: 'app',
			title: 'Make Conformator a Platform App',
			what: 'Mark Conformator’s Consumer as a Platform App in the API Manager and grant it the Scopes it asks for. With them, it creates the definitions of the records it keeps in the central space.',
			who: 'An administrator, in the API Manager.',
			href: f.links.appPlatformApps ?? '/setup#platform-app',
			action: f.links.appPlatformApps ? 'Open it in Platform Apps' : 'See it on the setup page',
			progress:
				f.appScopesHeld === null ? undefined : !f.appScopesHeld ? 'It is missing some Scopes; the setup page lists them.' : f.entitiesReady ? 'It holds every Scope, and its records are ready.' : 'It holds every Scope; its records are not all ready yet.',
			done: f.appScopesHeld === true && f.entitiesReady === true
		},
		{
			key: 'runner',
			title: 'Set up the runner',
			what: 'The runner is the separate service that calls participants’ systems. Start it, put its consumer_id in Conformator’s settings (CONFORMATOR_RUNNER_CONSUMER_ID), then mark it as a Platform App and grant it its Scope in the central space.',
			who: 'An administrator: the settings on the server, the Scopes in the API Manager.',
			href: f.links.runnerPlatformApps ?? '/setup#runner',
			action: f.links.runnerPlatformApps ? 'Open the runner in Platform Apps' : 'See it on the setup page',
			progress: f.runnerConsumerIdSet ? 'Its consumer_id is set. Check its Scope in Platform Apps.' : 'Its consumer_id is not set yet.',
			done: f.runnerConsumerIdSet
		},
		{
			key: 'signing',
			title: 'Add the report signing key',
			what: 'Conformator signs every conformance report, so anyone can check it. Make an Ed25519 key, keep it out of the repository, and point REPORT_SIGNING_KEY_FILE at it.',
			who: 'An administrator, on the server.',
			href: '/setup#signing',
			action: 'See how on the setup page',
			progress: f.signingKeyReady ? 'The key is in place.' : 'There is no key yet.',
			done: f.signingKeyReady
		},
		{
			key: 'staff',
			title: 'Give the regulator’s staff their Roles',
			what: 'Staff ask for the Roles they need on the setup page. Accept their requests in the API Manager, or grant Roles there directly. Give reviewing and approving to different people.',
			who: 'An administrator, in the API Manager.',
			href: f.links.roleRequests ?? '/setup#roles',
			action: f.links.roleRequests ? 'Open Role requests' : 'See the Roles on the setup page',
			progress:
				f.waitingRoleRequests === null ? undefined : f.waitingRoleRequests ? `${plural(f.waitingRoleRequests, 'staff Role request is', 'staff Role requests are')} waiting.` : 'No staff Role request is waiting.',
			done: f.waitingRoleRequests === 0
		}
	]);
}

export function regulatorSteps(f: RegulatorFacts): Step[] {
	const rolesDone = f.staffRolesHeld !== null && f.staffRolesHeld >= f.staffRolesTotal;
	return withNext([
		{
			key: 'roles',
			title: 'Get your staff Roles',
			what: 'Staff Roles let you keep the catalogue, register participants and issue reports. Ask for the ones you need on the setup page; an administrator accepts them in the API Manager.',
			who: 'You ask; an administrator accepts.',
			href: '/staff/access',
			action: 'See your Roles',
			progress: f.staffRolesHeld === null ? undefined : `You hold ${f.staffRolesHeld} of ${f.staffRolesTotal} staff Roles.`,
			done: rolesDone
		},
		{
			key: 'catalogue',
			title: 'Build the test catalogue',
			what: 'Record your rules as requirements, then make a suite of tests for one kind of system and one family of APIs. Choose an OBP API version or an OpenAPI file, and Conformator suggests the tests’ IDs and titles.',
			who: 'Staff who keep the catalogue.',
			href: '/staff/suites',
			action: 'Open suites and tests',
			shortcut: { href: '/staff/example-data', label: 'Or add the example suite' },
			progress: f.suites === null ? undefined : f.suites ? `There ${f.suites === 1 ? 'is' : 'are'} ${plural(f.suites, 'suite', 'suites')}.` : 'There are no suites yet.',
			done: some(f.suites)
		},
		{
			key: 'approve',
			title: 'Approve a suite',
			what: 'A suite is a draft until it is approved. Participants can run only approved suites, and an approved suite never changes: a change is a new version.',
			who: 'Staff who approve suites.',
			href: '/staff/suites',
			action: 'Approve a suite',
			progress: f.approvedSuites === null ? undefined : f.approvedSuites ? `${plural(f.approvedSuites, 'suite is', 'suites are')} approved.` : 'No suite is approved yet.',
			done: some(f.approvedSuites)
		},
		{
			key: 'participant',
			title: 'Register a participant',
			what: 'Register the bank, payment service provider or third-party provider, naming the first admin of its Organisation, then admit it and set up its own space. The Organisation’s members get access to the space, so they can log in and test.',
			who: 'Staff who manage participants.',
			href: '/staff/participants',
			action: 'Open participants',
			progress: f.participants === null ? undefined : f.participants ? `${plural(f.participants, 'participant is', 'participants are')} registered.` : 'No participant is registered yet.',
			done: some(f.participants)
		},
		{
			key: 'review',
			title: 'Review submissions and issue reports',
			what: 'When a participant submits a run, a reviewer assesses the tests a person must decide, and an approver who did not assess it makes the final decision. Approval issues a signed conformance report.',
			who: 'Reviewers and approvers. Nobody does both for the same submission.',
			href: '/reviews',
			action: 'Open reviews',
			progress: f.reports === null ? undefined : f.reports ? `${plural(f.reports, 'report has', 'reports have')} been issued.` : 'No report has been issued yet.',
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
			title: 'Log in',
			what: 'Log in with the account your organisation uses for the regulator’s sandbox.',
			who: 'You.',
			href: '/login?return_to=%2Fstart%3Ffor%3Dparticipant',
			action: 'Log in',
			progress: f.loggedIn ? 'You are logged in.' : undefined,
			done: f.loggedIn
		},
		{
			key: 'space',
			title: 'Join your organisation’s space',
			what: 'The regulator registers your organisation and adds you to its space, where your systems, runs and results are kept apart from everyone else’s. If you cannot see it, ask the regulator to add you.',
			who: 'The regulator’s staff add you.',
			href: '/spaces',
			action: 'See your organisation',
			progress: f.spaces === null ? undefined : spaces.length ? `You belong to ${spaces.map((s) => s.name).join(', ')}.` : 'You do not belong to a space yet.',
			done: spaces.length > 0
		},
		{
			key: 'system',
			title: 'Add a system to test',
			what: 'Add your non-production system: what it is (an API provider, an authorisation server or an API consumer), its address, and the client id your sandbox gave the runner. Secrets are never kept here.',
			who: 'Your organisation’s people.',
			href: spaceHref,
			action: 'Add a system',
			progress: f.systems === null ? undefined : f.systems ? `You have ${plural(f.systems, 'system', 'systems')}.` : 'No system yet.',
			done: some(f.systems)
		},
		{
			key: 'run',
			title: 'Run a suite',
			what: 'Choose an approved suite and start a run against your system. The runner calls your system as a real partner would, and records each request, response and outcome: pass, fail or blocked.',
			who: 'Your organisation’s people.',
			href: spaceHref,
			action: 'Start a run',
			shortcut: { href: '/catalogue', label: 'See what the suites test' },
			progress: f.runs === null ? undefined : f.runs ? `You have started ${plural(f.runs, 'run', 'runs')}.` : 'No run yet.',
			done: some(f.runs)
		},
		{
			key: 'submit',
			title: 'Give evidence and submit',
			what: 'Fix what failed and run again. When you are ready, submit a finished run for review, with evidence for the tests a person must decide. You can ask for a waiver of a test, or appeal a result.',
			who: 'Your organisation’s people.',
			href: spaceHref,
			action: 'Submit a run',
			progress: f.submissions === null ? undefined : f.submissions ? `You have made ${plural(f.submissions, 'submission', 'submissions')}.` : 'No submission yet.',
			done: some(f.submissions)
		},
		{
			key: 'report',
			title: 'Receive your conformance report',
			what: 'When the regulator approves your submission, Conformator issues a signed conformance report. Anyone can check it by its reference, such as CR-2026-7K3QX9MD.',
			who: 'The regulator approves; anyone can check the report.',
			href: '/reports',
			action: 'Check a report',
			progress: f.approvedSubmissions === null ? undefined : f.approvedSubmissions ? `${plural(f.approvedSubmissions, 'submission has', 'submissions have')} been approved.` : 'None approved yet.',
			done: some(f.approvedSubmissions)
		}
	]);
}

/** Which track to show first: the administrator's until Conformator is set up, then the regulator's for staff, else the participant's. */
export function defaultTrack(isStaff: boolean, setupDone: boolean | null): Track {
	if (setupDone !== true) return 'admin';
	return isStaff ? 'regulator' : 'participant';
}
