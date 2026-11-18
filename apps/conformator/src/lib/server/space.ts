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
import { env } from '$env/dynamic/private';

/** The central space: the bank id holding the test catalogue, the participant register and the reports. */
export function centralSpace(): string {
	return env.OBP_ENTITY_SPACE_ID?.trim() || 'conformator';
}

/**
 * The bank id proposed for a new participant's own space: `<central space>-<slug of the name>`, such as
 * `conformator-example-bank`. Bank ids are at most 36 characters here, so the slug is cut to fit.
 */
export function proposedParticipantSpace(legalName: string, central = centralSpace()): string {
	const slug = legalName
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const room = Math.max(1, 36 - central.length - 1);
	return `${central}-${slug.slice(0, room).replace(/-+$/, '') || 'participant'}`;
}

/** Whether a bank id is safe to use as a participant space: lower-case letters, digits and hyphens. */
export function isSpaceId(value: string): boolean {
	return /^[a-z0-9][a-z0-9-]{1,35}$/.test(value);
}

/** The runner's Consumer, by consumer_id: setting up a participant's space grants it the Scopes it needs there. */
export function runnerConsumerId(): string {
	return env.CONFORMATOR_RUNNER_CONSUMER_ID?.trim() ?? '';
}
