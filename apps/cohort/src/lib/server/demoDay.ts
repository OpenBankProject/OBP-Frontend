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
import { demoSlotOf, pitchFeedbackOf, runningOrder, type DemoSlot, type PitchFeedback } from '$lib/demoDay';
import { requestApplicationAccessToken } from './applicationToken';
import { DEMO_SLOT, PITCH_FEEDBACK, SESSION } from './entities/definitions';
import { getRecord, idOf, listRecords } from './records';
import { sessionsFromRecords } from './sessions';

const logger = createLogger('CohortDemoDay');

/** A demo day's running order: public, so read without a token. */
export async function slotsOf(sessionId: string): Promise<DemoSlot[]> {
	const records = await listRecords(DEMO_SLOT, 'public').catch(() => []);
	return runningOrder(records.map((r) => demoSlotOf(idOf(DEMO_SLOT, r), r)).filter((slot) => slot.session_id === sessionId));
}

/** Every demo day slot, for a startup's own programme page. */
export async function allSlots(): Promise<DemoSlot[]> {
	const records = await listRecords(DEMO_SLOT, 'public').catch(() => []);
	return records.map((r) => demoSlotOf(idOf(DEMO_SLOT, r), r));
}

/**
 * A demo day session for its public page, read as Cohort: only a session of kind demo_day, and only what the page
 * shows (title, time, place). Null for anything else.
 */
export async function publicDemoDay(sessionId: string) {
	const { token } = await requestApplicationAccessToken();
	if (!token) return null;
	const record = await getRecord(SESSION, '', sessionId, token).catch(() => null);
	const session = record ? sessionsFromRecords([record])[0] : undefined;
	if (!session || session.kind !== 'demo_day') return null;
	return { id: session.id, programme_id: session.programme_id, title: session.title, starts_at: session.starts_at, duration_minutes: session.duration_minutes, location: session.location };
}

/** The feedback on these participants' pitches (the caller checked they are the User's own), read as Cohort. */
export async function feedbackOfParticipants(participantIds: string[]): Promise<PitchFeedback[]> {
	if (participantIds.length === 0) return [];
	const { token } = await requestApplicationAccessToken();
	if (!token) return [];
	try {
		return (await listRecords(PITCH_FEEDBACK, '', token))
			.map((r) => pitchFeedbackOf(idOf(PITCH_FEEDBACK, r), r))
			.filter((f) => participantIds.includes(f.participant_id))
			.sort((a, b) => b.given_at.localeCompare(a.given_at));
	} catch (err) {
		logger.warn('Cohort could not read pitch feedback (does it hold the Scope shown on /staff/setup?):', err);
		return [];
	}
}
