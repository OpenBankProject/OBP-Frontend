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
 * The Scopes OBP-Conformator-Runner's Consumer needs. Plain data, so the runner declares exactly the list that the web
 * app grants when an administrator sets up a participant's space.
 */

export interface RunnerScope {
	role_name: string;
	/** A bank id, or '' for a system Role. */
	bank_id: string;
	needed_for: string;
}

/** Scopes in the central space: reading the participant register, to find the participants' spaces. */
export function runnerCentralScopes(centralSpace: string): RunnerScope[] {
	return [
		{
			role_name: 'CanGetDynamicEntityRecord_conformator_participant',
			bank_id: centralSpace,
			needed_for: "Finding each participant's own space, where their runs wait."
		}
	];
}

/** Scopes in one participant's space: reading queued runs and systems, and recording runs and results. */
export function runnerSpaceScopes(space: string): RunnerScope[] {
	return [
		{ role_name: 'CanGetDynamicEntityRecord_conformator_run', bank_id: space, needed_for: 'Finding the runs waiting to be run.' },
		{ role_name: 'CanUpdateDynamicEntityRecord_conformator_run', bank_id: space, needed_for: 'Recording that a run started, finished or could not run.' },
		{ role_name: 'CanGetDynamicEntityRecord_conformator_system', bank_id: space, needed_for: 'Reading the address of the system to test.' },
		{ role_name: 'CanCreateDynamicEntityRecord_conformator_result', bank_id: space, needed_for: 'Recording the result of each test.' }
	];
}
