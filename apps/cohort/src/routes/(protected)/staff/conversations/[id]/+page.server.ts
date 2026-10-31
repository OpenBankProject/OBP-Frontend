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
import { parseMessages } from '$lib/conversations';
import { OPEY_CONVERSATION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { getRecordWithMetadata, userToken } from '$lib/server/records';
import type { PageServerLoad } from './$types';

/** One recorded conversation, read through the community URL (needs the Get Role at the space). */
export const load: PageServerLoad = async ({ params, locals }) => {
	const { record, metadata } = await getRecordWithMetadata(OPEY_CONVERSATION, 'community', params.id, userToken(locals)).catch(
		(err) => {
			const message = messageOf(err);
			error(/OBP-20006|missing/i.test(message) ? 403 : 404, message);
		}
	);
	return {
		conversation: {
			title: String(record.title ?? ''),
			user_id: String(metadata.created?.on_behalf_of_user_id ?? metadata.created?.user_id ?? ''),
			page: String(record.page ?? ''),
			thread_id: String(record.thread_id ?? ''),
			started_at: String(record.started_at ?? ''),
			updated_at: String(record.updated_at ?? ''),
			consent_reference_ids: String(record.consent_reference_ids ?? '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		},
		messages: parseMessages(record.messages_json)
	};
};
