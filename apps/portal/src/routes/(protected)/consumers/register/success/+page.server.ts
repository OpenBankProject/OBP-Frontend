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
import { createLogger, redactForLog } from '@obp/shared/utils';
const logger = createLogger('ConsumerRegisterSuccessServer');
import type { RequestEvent } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';

export async function load(event: RequestEvent ) {
    const { cookies } = event;
    // The OBP-API host these credentials work with, shown so the developer knows where to use them
    const apiHost = (publicEnv.PUBLIC_OBP_BASE_URL ?? '').replace(/\/+$/, '');

    const consumerDataCookie = cookies.get('consumer_data');
    // The cookie holds the new Consumer's key and secret, so it is not logged; only whether it is there.
    logger.debug("Consumer Data Cookie present:", Boolean(consumerDataCookie));

    if (consumerDataCookie) {

        cookies.delete('consumer_data', { path: '/' });
        
        try {
            const consumerData = JSON.parse(consumerDataCookie);
            
            logger.debug("Parsed Consumer Data:", redactForLog(consumerData));
            
            return {
                consumerData,
                apiHost
            }
        } catch (error) {
            logger.error("Failed to parse consumer data cookie:", error);
            return {
                message: "Failed to parse consumer data cookie."
            };
        }
        
    }

    return {
        consumerData: null,
        apiHost
    }
}