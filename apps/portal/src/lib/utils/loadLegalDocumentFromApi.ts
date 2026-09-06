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
const logger = createLogger('LegalDocLoader');
import { obp_requests } from "$lib/obp/requests";

/**
 * Fetches raw Markdown content from the OBP webui-props endpoint.
 * @param name The `name` of the webui_props entry (e.g., "webui_terms_and_conditions")
 * @returns A string of raw Markdown content
 * @throws If the property is not found or is not a string
 */
interface WebUIProp {
    name: string;
    value: string;
}

export async function getLegalMarkdownFromWebUIProps(name: string): Promise<string> {
    let json: any;
    try {
        json = await obp_requests.get('/obp/v5.1.0/webui-props?active=true');
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
