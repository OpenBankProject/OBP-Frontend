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
import { describe, expect, it } from 'vitest';
import { adminSteps, defaultTrack, participantSteps, regulatorSteps, withNext, type AdminFacts, type RegulatorFacts } from './gettingStarted';

const newInstallation: AdminFacts = {
	space: 'conformator',
	spaceExists: false,
	appScopesHeld: false,
	entitiesReady: false,
	runnerConsumerIdSet: false,
	signingKeyReady: false,
	waitingRoleRequests: null,
	links: { createBank: 'https://manager.example.com/banks/create', appPlatformApps: null, runnerPlatformApps: null, roleRequests: null }
};

const fresh: RegulatorFacts = {
	loggedIn: true,
	staffRolesHeld: 0,
	staffRolesTotal: 14,
	suites: 0,
	approvedSuites: 0,
	participants: null,
	reports: 0
};

describe('withNext', () => {
	it('marks the first step not done as next, even after a later step is done', () => {
		const step = { title: 't', what: 'w', who: 'x', href: '/', action: 'a' };
		const statuses = withNext([
			{ ...step, key: 'a', done: true },
			{ ...step, key: 'b', done: false },
			{ ...step, key: 'c', done: true },
			{ ...step, key: 'd', done: false }
		]).map((s) => s.status);
		expect(statuses).toEqual(['done', 'next', 'done', 'todo']);
	});
});

describe('adminSteps', () => {
	it('starts by creating the central space, in the API Manager', () => {
		const steps = adminSteps(newInstallation);
		expect(steps[0]).toMatchObject({ key: 'space', status: 'next', href: 'https://manager.example.com/banks/create', progress: 'The bank conformator does not exist yet.' });
	});

	it('falls back to the setup page when the API Manager is not known', () => {
		const steps = adminSteps({ ...newInstallation, spaceExists: true });
		expect(steps.find((s) => s.key === 'app')).toMatchObject({ status: 'next', href: '/setup#platform-app' });
	});

	it('counts the Platform App step as done only when its records are ready too', () => {
		const app = (f: Partial<AdminFacts>) => adminSteps({ ...newInstallation, spaceExists: true, ...f }).find((s) => s.key === 'app')!;
		expect(app({ appScopesHeld: true, entitiesReady: false }).status).toBe('next');
		expect(app({ appScopesHeld: true, entitiesReady: true }).status).toBe('done');
	});

	it('leaves the staff step open when the waiting requests cannot be read', () => {
		const ready = { ...newInstallation, spaceExists: true, appScopesHeld: true, entitiesReady: true, runnerConsumerIdSet: true, signingKeyReady: true };
		expect(adminSteps(ready).find((s) => s.key === 'staff')).toMatchObject({ status: 'next', progress: undefined });
		expect(adminSteps({ ...ready, waitingRoleRequests: 2 }).find((s) => s.key === 'staff')?.progress).toBe('2 staff Role requests are waiting.');
		expect(adminSteps({ ...ready, waitingRoleRequests: 0 }).every((s) => s.status === 'done')).toBe(true);
	});
});

describe('regulatorSteps', () => {
	it('starts with the staff Roles', () => {
		const steps = regulatorSteps(fresh);
		expect(steps[0]).toMatchObject({ key: 'roles', status: 'next' });
		expect(steps.filter((s) => s.status === 'next')).toHaveLength(1);
	});

	it('moves on to the catalogue once you hold every Role', () => {
		const steps = regulatorSteps({ ...fresh, staffRolesHeld: 14 });
		expect(steps.find((s) => s.status === 'next')?.key).toBe('catalogue');
		expect(steps.find((s) => s.key === 'roles')?.progress).toBe('You hold 14 of 14 staff Roles.');
	});

	it('never shows a step as done when its fact is not known', () => {
		const steps = regulatorSteps({ ...fresh, staffRolesHeld: null, participants: null });
		expect(steps.find((s) => s.key === 'roles')?.status).not.toBe('done');
		expect(steps.find((s) => s.key === 'participant')?.status).not.toBe('done');
		expect(steps.find((s) => s.key === 'participant')?.progress).toBeUndefined();
	});
});

describe('participantSteps', () => {
	it('asks a visitor to log in first', () => {
		const steps = participantSteps({ loggedIn: false, spaces: null, systems: null, runs: null, submissions: null, approvedSubmissions: null });
		expect(steps[0]).toMatchObject({ key: 'login', status: 'next' });
	});

	it('goes straight to the only space, and on to the first run', () => {
		const steps = participantSteps({ loggedIn: true, spaces: [{ id: 'conformator-example-bank', name: 'Example Bank' }], systems: 1, runs: 0, submissions: 0, approvedSubmissions: 0 });
		expect(steps.find((s) => s.status === 'next')?.key).toBe('run');
		expect(steps.find((s) => s.key === 'system')?.href).toBe('/spaces/conformator-example-bank');
		expect(steps.find((s) => s.key === 'space')?.progress).toBe('You belong to Example Bank.');
	});

	it('lets a User with several spaces choose', () => {
		const spaces = [
			{ id: 'conformator-a', name: 'A' },
			{ id: 'conformator-b', name: 'B' }
		];
		const steps = participantSteps({ loggedIn: true, spaces, systems: 0, runs: 0, submissions: 0, approvedSubmissions: 0 });
		expect(steps.find((s) => s.key === 'system')?.href).toBe('/spaces');
	});
});

describe('defaultTrack', () => {
	it('shows the administrator’s steps until Conformator is set up, then staff’s or participants’', () => {
		expect(defaultTrack(false, false)).toBe('admin');
		expect(defaultTrack(true, null)).toBe('admin');
		expect(defaultTrack(true, true)).toBe('regulator');
		expect(defaultTrack(false, true)).toBe('participant');
	});
});
