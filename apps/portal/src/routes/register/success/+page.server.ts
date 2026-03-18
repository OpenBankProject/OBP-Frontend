import { createLogger } from '$lib/utils/logger';
const logger = createLogger('RegisterSuccessServer');
import type { RequestEvent } from '@sveltejs/kit';

export async function load(event: RequestEvent ) {
    const { cookies } = event;

    const userDataCookie = cookies.get('user');
    logger.debug("User Data Cookie:", userDataCookie);

    if (userDataCookie) {

        cookies.delete('consumer_data', { path: '/' });
        
        try {
            const userData = JSON.parse(userDataCookie);
            
            logger.debug("Parsed User Data:", userData);
            
            return {
                userData
            }
        } catch (error) {
            logger.error("Failed to parse user data cookie:", error);
            return {
                error: "Failed to parse user data cookie."
            };
        }
        
    }

    return {
        userData: null
    }
}