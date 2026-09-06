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
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findOrCreateDm } from '$lib/chat/startDm';
import { OBPRequestError } from '@obp/shared/obp';
import { createLogger } from '@obp/shared/utils';

const logger = createLogger('ChatDmDeepLink');

/**
 * Deep link to a direct message: /user/chat/dm/<user_id> finds or creates the
 * 1-on-1 room with that user and redirects into it. Linkable from other apps
 * (e.g. the API Manager's user detail page); an anonymous visitor goes
 * through login first via the (protected) group.
 */
export const load: PageServerLoad = async (event) => {
	const session = event.locals.session;
	const accessToken = session.data.oauth?.access_token;
	const currentUserId = session.data.user?.user_id;
	if (!accessToken || !currentUserId) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	// The target may be the current user: a self-DM is a private room whose
	// only participant is you, handled by the same find-or-create logic.
	const targetUserId = event.params.user_id;

	let chatRoomId: string;
	try {
		chatRoomId = await findOrCreateDm(accessToken, currentUserId, targetUserId);
	} catch (e) {
		logger.error(`Could not start DM with ${targetUserId}:`, e);
		if (e instanceof OBPRequestError) {
			error(502, { message: e.message });
		}
		error(500, { message: 'Could not start the direct message. Please try again later.' });
	}

	redirect(303, `/user/chat/${chatRoomId}`);
};
