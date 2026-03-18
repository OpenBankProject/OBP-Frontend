import { createLogger } from '$lib/utils/logger';
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
                error: "Failed to parse consumer data cookie."
            };
        }
        
    }

    return {
        consumerData: null
    }
}