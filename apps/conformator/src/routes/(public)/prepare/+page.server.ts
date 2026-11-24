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
import { userToken } from '$lib/server/records';
import { adminFacts, participantFacts, readSetup, regulatorFacts, setupDone } from '$lib/server/gettingStarted';
import { adminSteps, defaultTrack, participantSteps, regulatorSteps, type Step, type Track } from '$lib/gettingStarted';
import type { PageServerLoad } from './$types';

/**
 * Prepare Conformator for Use: the steps for the administrator, the regulator's staff and participants, with each step's progress read from OBP-API.
 * Anyone can read it; a logged-in User also sees how far they have got.
 */
export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { isStaff } = await parent();
	const token = userToken(locals);
	const setup = await readSetup();
	const asked = url.searchParams.get('for');
	const track: Track = asked === 'admin' || asked === 'regulator' || asked === 'participant' ? asked : defaultTrack(isStaff, setupDone(setup));
	let steps: Step[];
	if (track === 'admin') steps = adminSteps(await adminFacts(token, setup));
	else if (track === 'regulator') steps = regulatorSteps(await regulatorFacts(token));
	else steps = participantSteps(await participantFacts(token));
	return { track, steps, loggedIn: Boolean(token) };
};
