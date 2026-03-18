import { jwtDecode } from 'jwt-decode';
import { createLogger } from './logger';

const logger = createLogger('JWTUtils');

export interface JWTPayload {
  [key: string]: any;
  sub?: string;
  username?: string;
  user_name?: string;
  login?: string;
  user_id?: string;
  preferred_username?: string;
  name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
}

/**
 * Extract comprehensive user information from JWT token for logging purposes
 * 
 * @param jwt - The JWT token string
 * @returns Comprehensive user information string
 */
export function extractUsernameFromJWT(jwt: string): string {
  try {
    const decoded: JWTPayload = jwtDecode(jwt);
    
    // Collect all available user information
    const userInfo: string[] = [];
    
    // Human-readable identifiers first
    if (decoded.email) userInfo.push(`email:${decoded.email}`);
    if (decoded.name) userInfo.push(`name:${decoded.name}`);
    if (decoded.preferred_username) userInfo.push(`preferred_username:${decoded.preferred_username}`);
    if (decoded.username) userInfo.push(`username:${decoded.username}`);
    if (decoded.user_name) userInfo.push(`user_name:${decoded.user_name}`);
    if (decoded.login) userInfo.push(`login:${decoded.login}`);
    
    // System identifiers
    if (decoded.sub) userInfo.push(`sub:${decoded.sub}`);
    if (decoded.user_id) userInfo.push(`user_id:${decoded.user_id}`);
    
    // Additional context
    if (decoded.iss) userInfo.push(`iss:${decoded.iss}`);
    if (decoded.aud) userInfo.push(`aud:${Array.isArray(decoded.aud) ? decoded.aud.join(',') : decoded.aud}`);
    
    const userInfoString = userInfo.length > 0 ? userInfo.join(' | ') : 'unknown';
    
    logger.info(`extractUsernameFromJWT says: User consent info - ${userInfoString}`);
    return userInfo.length > 0 ? userInfo[0].split(':')[1] : 'unknown'; // Return first (most human) identifier for backwards compatibility
    
  } catch (error) {
    logger.error('extractUsernameFromJWT says: Failed to decode JWT:', error);
    return 'unknown';
  }
}

/**
 * Check if a JWT token is expired
 * 
 * @param jwt - The JWT token string
 * @returns true if expired, false if valid
 */
export function isJWTExpired(jwt: string): boolean {
  try {
    const decoded: JWTPayload = jwtDecode(jwt);
    if (!decoded.exp) {
      return true; // No expiration time means we treat it as expired
    }
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch (error) {
    logger.error('isJWTExpired says: Failed to decode JWT:', error);
    return true; // Treat invalid JWTs as expired
  }
}

/**
 * Get JWT payload for debugging purposes
 * 
 * @param jwt - The JWT token string
 * @returns The decoded JWT payload or null if invalid
 */
export function getJWTPayload(jwt: string): JWTPayload | null {
  try {
    return jwtDecode(jwt);
  } catch (error) {
    logger.error('getJWTPayload says: Failed to decode JWT:', error);
    return null;
  }
}