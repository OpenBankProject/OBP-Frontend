import { createLogger } from './logger';
const logger = createLogger('LegalDocLoader');
import type { OBPRequests } from '$lib/obp/requests';

/**
 * Fetches raw Markdown content from the OBP webui-props endpoint.
 * @param obpRequests An OBPRequests instance to use for the API call
 * @param name The `name` of the webui_props entry (e.g., "webui_terms_and_conditions")
 * @returns A string of raw Markdown content
 * @throws If the property is not found or is not a string
 */
interface WebUIProp {
    name: string;
    value: string;
}

export async function getLegalMarkdownFromWebUIProps(obpRequests: OBPRequests, name: string): Promise<string> {
    let json: any;
    try {
        json = await obpRequests.get('/obp/v5.1.0/webui-props?active=true');
    } catch (err) {
        logger.error(`Failed to fetch legal markdown for "${name}":`, err);
        throw new Error(`Failed to fetch legal markdown content`);
    }

    if (!json?.webui_props || !Array.isArray(json.webui_props)) {
        throw new Error('Invalid response format: missing webui_props');
    }

    const prop = json.webui_props.find((p: WebUIProp) => p.name === name);

    if (!prop || typeof prop.value !== 'string') {
        throw new Error(`Property "${name}" not found or not a string`);
    }

    return prop.value;
}
