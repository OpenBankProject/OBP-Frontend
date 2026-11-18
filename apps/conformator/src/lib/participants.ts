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
import { isOneOf, PARTICIPANT_STAGES, type ParticipantStage } from '@obp/shared/conformator';

/** A participant decision as read from OBP-API: its stage and when it was made. */
export interface StageRecord {
	stage?: unknown;
	decided_at?: unknown;
	created_at?: string | null;
}

/**
 * A participant's current stage: the stage of their latest decision, by when it was decided (or, failing that, when it
 * was recorded). Null before any decision. A decision naming an unknown stage is skipped, never guessed at.
 */
export function currentStage(decisions: StageRecord[]): ParticipantStage | null {
	const when = (d: StageRecord) => String(d.decided_at || d.created_at || '');
	const known = decisions.filter((d) => isOneOf(PARTICIPANT_STAGES, d.stage));
	if (known.length === 0) return null;
	const latest = known.reduce((a, b) => (when(b) >= when(a) ? b : a));
	return latest.stage as ParticipantStage;
}

/**
 * The stages a participant can be moved to from where they are. Exited is final. A suspended participant can only
 * return to remediation or exit. Before any decision, the only step is admission.
 */
export function nextStages(current: ParticipantStage | null): ParticipantStage[] {
	switch (current) {
		case null:
			return ['admitted'];
		case 'exited':
			return [];
		case 'suspended':
			return ['remediation', 'exited'];
		default:
			return PARTICIPANT_STAGES.filter((s) => s !== current && s !== 'admitted');
	}
}
