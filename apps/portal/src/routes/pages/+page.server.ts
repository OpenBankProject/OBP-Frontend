import type { PageServerLoad } from './$types';
import { createLogger } from '@obp/shared/utils';
import { listPublishedPages, PortalPagesUnavailable } from '$lib/server/landing/portalPages';

const logger = createLogger('PagesIndex');

export const load: PageServerLoad = async () => {
	try {
		const pages = await listPublishedPages();
		return {
			pages: pages.map(({ source, ...rest }) => rest),
			unavailable: ''
		};
	} catch (e) {
		const message = e instanceof PortalPagesUnavailable ? e.message : 'Pages are not available right now.';
		logger.error('Pages index unavailable:', e);
		return { pages: [], unavailable: message };
	}
};
