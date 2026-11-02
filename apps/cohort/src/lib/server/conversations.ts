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
import { parseMessages } from '$lib/conversations';
import { OPEY_CONVERSATION } from './entities/definitions';
import { getRecordWithMetadata, idOf, listRecordsWithMetadata, type Access } from './records';

/**
 * Reading recorded Opey conversations: a User's own through /my/ (no Role), or every User's through the community
 * URL for auditors (CanGetDynamicEntityRecord_cohort_opey_conversation at the space).
 */

export async function listConversations(access: Extract<Access, 'my' | 'community'>, token: string) {
	const rows = await listRecordsWithMetadata(OPEY_CONVERSATION, access, token);
	return rows
		.map(({ record, metadata }) => ({
			id: idOf(OPEY_CONVERSATION, record),
			title: String(record.title ?? ''),
			user_id: String(metadata.created?.on_behalf_of_user_id ?? metadata.created?.user_id ?? ''),
			page: String(record.page ?? ''),
			message_count: Number(record.message_count ?? 0),
			started_at: String(record.started_at ?? ''),
			updated_at: String(record.updated_at ?? '')
		}))
		.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getConversation(access: Extract<Access, 'my' | 'community'>, id: string, token: string) {
	const { record, metadata } = await getRecordWithMetadata(OPEY_CONVERSATION, access, id, token);
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
}
