import { createOpeyAuthHandler } from '$lib/server/opey';
import { env } from '$env/dynamic/private';

const { POST } = createOpeyAuthHandler({
	opeyBaseUrl: env.OPEY_BASE_URL || 'http://localhost:5000',
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token
});

export { POST };
