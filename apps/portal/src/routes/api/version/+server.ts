import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		version: __APP_VERSION__,
		commit: __GIT_COMMIT__,
		branch: __GIT_BRANCH__,
		buildTime: __BUILD_TIME__
	});
};