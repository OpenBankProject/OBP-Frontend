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
import { PROGRAMME } from '$lib/server/entities/definitions';
import { participantsOfUser } from '$lib/server/participants';
import { getRecord } from '$lib/server/records';
import type { PageServerLoad } from './$types';

/** The graduation certificate of one of the User's own participations, once it has graduated. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '')).find((p) => p.id === params.id);
	if (!participant) error(404, 'Not found');
	if (participant.status !== 'graduated' && participant.stage !== 'graduated') error(403, 'This startup has not graduated yet.');
	const programme = await getRecord(PROGRAMME, 'public', participant.programme_id).catch(() => null);
	return {
		certificate: {
			startup_name: participant.startup_name,
			programme_name: String(programme?.name ?? ''),
			graduated_on: String(participant.graduated_at ?? '').slice(0, 10),
			reference: participant.id.slice(0, 8).toUpperCase()
		}
	};
};
