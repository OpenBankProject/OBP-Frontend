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
const logger = createLogger('ConsumerRegisterSuccessServer');
import type { RequestEvent } from '@sveltejs/kit';

export async function load(event: RequestEvent ) {
    const { cookies } = event;

    const consumerDataCookie = cookies.get('consumer_data');
    logger.debug("Consumer Data Cookie:", consumerDataCookie);

    if (consumerDataCookie) {

        cookies.delete('consumer_data', { path: '/' });
        
        try {
            const consumerData = JSON.parse(consumerDataCookie);
            
            logger.debug("Parsed Consumer Data:", consumerData);
            
            return {
                consumerData
            }
        } catch (error) {
            logger.error("Failed to parse consumer data cookie:", error);
            return {
                message: "Failed to parse consumer data cookie."
            };
        }
        
    }

    return {
        consumerData: null
    }
}