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
const logger = createLogger('LayoutServer');
import type { RequestEvent } from "@sveltejs/kit";
import { obp_requests } from '$lib/obp/requests';
// import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
// import { storePopup } from '@skeletonlabs/skeleton';
// storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

import { env } from "$env/dynamic/private";
import { env as publicEnv } from '$env/dynamic/public';

export interface RootLayoutData {
    userId?: string;
    email?: string;
    username?: string;
    externalLinks: Record<string, string>;
    showEarlyAccess?: boolean;
    totalUnreadCount?: number;
    publicObpMcpUrl?: string;
}

// The app-directory endpoint is public and its values change rarely, so cache
// it briefly instead of hitting OBP on every page load.
const APP_DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;
let appDirectoryCache: { values: Record<string, string>; fetchedAt: number } | null = null;

async function getAppDirectory(): Promise<Record<string, string>> {
	if (appDirectoryCache && Date.now() - appDirectoryCache.fetchedAt < APP_DIRECTORY_CACHE_TTL_MS) {
		return appDirectoryCache.values;
	}
	try {
		const response = await obp_requests.get('/obp/v6.0.0/app-directory');
		const values: Record<string, string> = {};
		for (const entry of response.app_directory || []) {
			if (entry.name && entry.value) {
				values[entry.name] = entry.value;
			}
		}
		appDirectoryCache = { values, fetchedAt: Date.now() };
		return values;
	} catch (error) {
		logger.warn('Failed to fetch app-directory:', error);
		// Serve stale values if we have them, otherwise nothing
		return appDirectoryCache?.values ?? {};
	}
}

export async function load(event: RequestEvent) {
	const { session } = event.locals;

	let data: Partial<RootLayoutData> = {};

	// Kick off the (cached) app-directory fetch early; awaited before returning
	const appDirectoryPromise = getAppDirectory();

	let externalLinks = {
		API_EXPLORER_URL: env.API_EXPLORER_URL,
		API_MANAGER_URL: env.API_MANAGER_URL,
		SANDBOX_POPULATOR_URL: env.SANDBOX_POPULATOR_URL,
		SUBSCRIPTIONS_URL: publicEnv.PUBLIC_SUBSCRIPTIONS_URL,
		LEGACY_PORTAL_URL: publicEnv.PUBLIC_LEGACY_PORTAL_URL
	};

	// Filter out undefined/null values and warn about missing ones
	const validExternalLinks: Record<string, string> = {};
	Object.entries(externalLinks).forEach(([name, url]) => {
		if (!url) {
			logger.warn(`Environment variable ${name} is not set, it will not show up in the menu.`);
		} else {
			validExternalLinks[name] = url;
		}
	});

	// Only treat the user as logged in if they have both user data and a valid access token
    if (session?.data?.user && session?.data?.oauth?.access_token) {
        data.userId = session.data.user.user_id;
        data.email = session.data.user.email;
        data.username = session.data.user.username;
    }

	// Check if user has EARLY_ACCESS personal data field set to YES
	let showEarlyAccess = false;
	let totalUnreadCount = 0;
	const accessToken = session?.data?.oauth?.access_token;
	if (accessToken) {
		try {
			const [personalDataResponse, chatRoomsResponse] = await Promise.all([
				obp_requests.get('/obp/v6.0.0/my/personal-data-fields', accessToken).catch((err) => {
					logger.warn('Failed to fetch personal data fields:', err);
					return { user_attributes: [] };
				}),
				obp_requests.get('/obp/v6.0.0/chat-rooms', accessToken).catch((err) => {
					logger.warn('Failed to fetch chat rooms for unread count:', err);
					return { chat_rooms: [] };
				})
			]);
			const fields = personalDataResponse.user_attributes || [];
			showEarlyAccess = fields.some(
				(f: { name: string; value: string }) => f.name === 'EARLY_ACCESS' && f.value === 'YES'
			);
			// The chat-rooms endpoint returns unread_count on each room directly
			const chatRooms = chatRoomsResponse.chat_rooms || [];
			totalUnreadCount = chatRooms.reduce(
				(sum: number, room: { unread_count?: number }) => sum + (room.unread_count || 0),
				0
			);
		} catch (error) {
			logger.warn('Could not fetch layout data:', error);
		}
	}

	const appDirectory = await appDirectoryPromise;

	return {
		...data,
		externalLinks: validExternalLinks,
		showEarlyAccess,
		totalUnreadCount,
		publicObpMcpUrl: appDirectory['public_obp_mcp_url']
	} as RootLayoutData
}
