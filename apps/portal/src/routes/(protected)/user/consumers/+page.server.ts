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
import { obp_requests } from '$lib/obp/requests';
import { error } from '@sveltejs/kit';
import type { OBPConsumer } from '$lib/obp/types';
import type { RequestEvent } from '@sveltejs/kit';

const logger = createLogger('UserConsumersServer');

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, {
			message: 'Unauthorized: No access token found in session.'
		});
	}

	let consumersResponse: { consumers: OBPConsumer[] } | undefined = undefined;

	try {
		consumersResponse = await obp_requests.get('/obp/v6.0.0/management/users/current/consumers', token);
		logger.debug('Raw API Response:', JSON.stringify(consumersResponse, null, 2));
	} catch (e) {
		logger.error('Error fetching consumers:', e);
		error(500, {
			message: 'Could not fetch consumers at this time. Please try again later.'
		});
	}

	if (!consumersResponse || !consumersResponse.consumers) {
		error(500, {
			message: 'Could not fetch consumers at this time. Please try again later.'
		});
	}

	const consumers = consumersResponse.consumers;

	// Log first consumer for debugging
	if (consumers.length > 0) {
		logger.debug('First consumer fields:', Object.keys(consumers[0]));
		logger.debug('First consumer data:', JSON.stringify(consumers[0], null, 2));
	}

	// Sort consumers by created date, most recent first
	consumers.sort((a: OBPConsumer, b: OBPConsumer) => {
		const dateA = a.created ? new Date(a.created).getTime() : 0;
		const dateB = b.created ? new Date(b.created).getTime() : 0;
		return dateB - dateA; // Most recent first
	});

	return {
		consumers
	};
}