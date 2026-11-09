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
import { error } from '@sveltejs/kit';
import { publicDemoDay, slotsOf } from '$lib/server/demoDay';
import { PROGRAMME } from '$lib/server/entities/definitions';
import { getRecord } from '$lib/server/records';
import type { PageServerLoad } from './$types';

/** A demo day's public page, for guests and investors: when and where, and the startups pitching in order. */
export const load: PageServerLoad = async ({ params }) => {
	const session = await publicDemoDay(params.sessionId);
	if (!session) error(404, 'Demo day not found');
	const [programme, slots] = await Promise.all([getRecord(PROGRAMME, 'public', session.programme_id).catch(() => null), slotsOf(session.id)]);
	return {
		session,
		programme: String(programme?.name ?? ''),
		slots: slots.map((s) => ({ id: s.id, position: s.position, starts_at: s.starts_at, startup_name: s.startup_name, pitch_title: s.pitch_title }))
	};
};
