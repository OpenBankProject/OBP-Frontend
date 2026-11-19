import { createLogger } from '$lib/utils/logger';
const logger = createLogger('LayoutServer');
import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { OBPClient } from '$lib/obp/client';
import type { AppDirectoryEntry } from '$lib/obp/types';

export interface RootLayoutData {
	userId?: string;
	email?: string;
	username?: string;
	appDirectory: AppDirectoryEntry[];
}

export async function load(event: RequestEvent) {
	const { session } = event.locals;

	let data: Partial<RootLayoutData> = {};

	// Get information about the user from the session if they are logged in
	if (session?.data?.user) {
		data.userId = session.data.user.user_id;
		data.email = session.data.user.email;
		data.username = session.data.user.username;
	}

	// Fetch app directory (no auth required)
	try {
		data.appDirectory = await OBPClient.getAppDirectory(env.PUBLIC_OBP_BASE_URL, 'v6.0.0');
	} catch (e) {
		logger.error('Failed to fetch app directory:', e);
		data.appDirectory = [];
	}

	return data as RootLayoutData;
}
