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

/**
 * A programme's stages, in order, and the gate before each. A gate is a condition on the startup's records:
 * its company is registered before it starts the programme; every milestone of the programme is accepted before it
 * graduates. Staff move a startup on; Cohort checks the gate again when they do.
 */

export const STAGES = ['onboarded', 'in_programme', 'graduated'] as const;
export type Stage = (typeof STAGES)[number];

export interface GateInput {
	stage: string;
	company_registered: boolean;
	milestones_accepted: number;
	milestones_total: number;
}

export interface NextStage {
	/** The stage it would move to, or null at the last one. */
	to: Stage | null;
	/** What is still missing for the gate, or null when it may move on. */
	missing: 'company' | 'milestones' | null;
}

export function nextStage(p: GateInput): NextStage {
	const at = STAGES.indexOf(p.stage as Stage);
	if (at < 0 || at === STAGES.length - 1) return { to: null, missing: null };
	const to = STAGES[at + 1];
	if (to === 'in_programme' && !p.company_registered) return { to, missing: 'company' };
	if (to === 'graduated' && p.milestones_accepted < p.milestones_total) return { to, missing: 'milestones' };
	return { to, missing: null };
}
