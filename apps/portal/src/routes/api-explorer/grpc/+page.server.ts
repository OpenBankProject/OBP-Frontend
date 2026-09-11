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
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { resolveGrpcTarget } from '@obp/shared/obp';
import { listGrpcServices, methodSignature } from '@obp/shared/server/explorer';
import type { PageServerLoad } from './$types';

/**
 * OBP's gRPC surface, read from the server by reflection — there are no resource docs for
 * it, so the server is the only description there is. Rendered on the server so the page
 * shows something on a deep link; a reflection failure is reported, not thrown, because an
 * OBP instance with gRPC switched off is a normal thing to be looking at.
 */
export const load: PageServerLoad = async () => {
	const target = resolveGrpcTarget({ ...env, ...publicEnv });
	const { host, services, error } = await listGrpcServices(target);

	return {
		/**
		 * The sidebar list for this section. Page data merges over layout data, so the page
		 * that already did the reflection supplies its own navigation rather than making the
		 * shell reflect a second time on every request.
		 */
		listGroups: [
			{
				name: '',
				items: services.map((s) => ({
					label: s.name.split('.').pop() ?? s.name,
					href: `#${s.name}`,
					note: String(s.methods.length)
				}))
			}
		],
		listPlaceholder: 'Search services',
		host,
		tls: target.tls,
		reflectionError: error ?? null,
		services: services.map((service) => ({
			name: service.name,
			error: service.error ?? null,
			methods: service.methods.map((method) => ({
				name: method.name,
				signature: methodSignature(method),
				requestStream: method.requestStream,
				responseStream: method.responseStream,
				requestFields: method.requestFields,
				responseFields: method.responseFields
			}))
		}))
	};
};
