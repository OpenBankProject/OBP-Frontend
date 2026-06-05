import { createLogger } from '@obp/shared/utils';
const logger = createLogger('SupportPage');
import { obp_requests } from '$lib/obp/requests';

const DEFAULT_SUPPORT_PLATFORM_URL = 'https://chat.openbankproject.com';

interface WebUIProp {
	name: string;
	value: string;
}

export async function load() {
	let supportPlatformUrl = DEFAULT_SUPPORT_PLATFORM_URL;

	try {
		const json = await obp_requests.get('/obp/v6.0.0/webui-props?active=true');
		const prop = (json?.webui_props as WebUIProp[] | undefined)?.find(
			(p) => p.name === 'webui_support_platform_url'
		);
		if (prop?.value) {
			supportPlatformUrl = prop.value;
		}
	} catch (e) {
		// Public page must render even if OBP-API is unreachable; fall back to the default.
		logger.warn('Could not fetch webui_support_platform_url, using default:', e);
	}

	return { supportPlatformUrl };
}
