#!/usr/bin/env node

/**
 * Debug script for OBP Portal OAuth/OIDC issues
 *
 * This script helps diagnose JWT token validation issues by:
 * 1. Fetching and displaying OIDC configuration
 * 2. Decoding JWT tokens to show claims
 * 3. Checking issuer and JWKS URI consistency
 *
 * Usage:
 * node debug-oauth.mjs [access_token]
 */

import fetch from 'node-fetch';
import { Buffer } from 'buffer';

// Configuration - update these based on your environment
const CONFIG = {
	OIDC_WELL_KNOWN_URL:
		process.env.OBP_OAUTH_WELL_KNOWN_URL ||
		'http://127.0.0.1:9000/obp-oidc/.well-known/openid-configuration',
	OBP_BASE_URL: process.env.PUBLIC_OBP_BASE_URL || 'http://localhost:8080',
	EXPECTED_ISSUER: process.env.VITE_OIDC_ISSUER || 'http://127.0.0.1:9000'
};

console.log('🔍 OBP OAuth Debug Tool');
console.log('========================\n');

// Utility function to decode JWT without verification
function decodeJWT(token) {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			throw new Error('Invalid JWT format');
		}

		const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
		const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

		return { header, payload };
	} catch (error) {
		console.error('❌ Failed to decode JWT:', error.message);
		return null;
	}
}

// Function to fetch and display OIDC configuration
async function checkOIDCConfiguration() {
	console.log('📋 Checking OIDC Configuration');
	console.log('-------------------------------');
	console.log(`Well-known URL: ${CONFIG.OIDC_WELL_KNOWN_URL}`);

	try {
		const response = await fetch(CONFIG.OIDC_WELL_KNOWN_URL);

		if (!response.ok) {
			console.error(`❌ Failed to fetch OIDC config: ${response.status} ${response.statusText}`);
			return null;
		}

		const config = await response.json();

		console.log('✅ OIDC Configuration fetched successfully');
		console.log(`   Issuer: ${config.issuer}`);
		console.log(`   Authorization Endpoint: ${config.authorization_endpoint}`);
		console.log(`   Token Endpoint: ${config.token_endpoint}`);
		console.log(`   JWKS URI: ${config.jwks_uri}`);
		console.log(`   Userinfo Endpoint: ${config.userinfo_endpoint}`);

		// Check if issuer matches expected
		if (config.issuer === CONFIG.EXPECTED_ISSUER) {
			console.log('✅ Issuer matches expected value');
		} else {
			console.log(`⚠️  Issuer mismatch:`);
			console.log(`   Expected: ${CONFIG.EXPECTED_ISSUER}`);
			console.log(`   Actual: ${config.issuer}`);
		}

		console.log('');
		return config;
	} catch (error) {
		console.error('❌ Error fetching OIDC configuration:', error.message);
		return null;
	}
}

// Function to test JWKS endpoint accessibility
async function checkJWKSEndpoint(jwksUri) {
	console.log('🔑 Checking JWKS Endpoint');
	console.log('-------------------------');
	console.log(`JWKS URI: ${jwksUri}`);

	try {
		const response = await fetch(jwksUri);

		if (!response.ok) {
			console.error(`❌ Failed to fetch JWKS: ${response.status} ${response.statusText}`);
			return false;
		}

		const jwks = await response.json();
		console.log(`✅ JWKS endpoint accessible`);
		console.log(`   Number of keys: ${jwks.keys ? jwks.keys.length : 0}`);

		if (jwks.keys && jwks.keys.length > 0) {
			jwks.keys.forEach((key, index) => {
				console.log(
					`   Key ${index + 1}: ${key.kty} (${key.alg || 'no alg specified'}) - ${key.kid || 'no kid'}`
				);
			});
		}

		console.log('');
		return true;
	} catch (error) {
		console.error('❌ Error fetching JWKS:', error.message);
		return false;
	}
}

// Function to analyze JWT token
function analyzeJWT(token, oidcConfig) {
	console.log('🔍 JWT Token Analysis');
	console.log('---------------------');

	const decoded = decodeJWT(token);
	if (!decoded) {
		return;
	}

	const { header, payload } = decoded;

	console.log('📄 Token Header:');
	console.log(`   Algorithm: ${header.alg}`);
	console.log(`   Type: ${header.typ}`);
	console.log(`   Key ID: ${header.kid || 'Not specified'}`);

	console.log('\n📄 Token Payload:');
	console.log(`   Issuer: ${payload.iss}`);
	console.log(`   Subject: ${payload.sub}`);
	console.log(`   Audience: ${Array.isArray(payload.aud) ? payload.aud.join(', ') : payload.aud}`);
	console.log(
		`   Issued At: ${payload.iat ? new Date(payload.iat * 1000).toISOString() : 'Not specified'}`
	);
	console.log(
		`   Expires At: ${payload.exp ? new Date(payload.exp * 1000).toISOString() : 'Not specified'}`
	);
	console.log(`   Client ID: ${payload.client_id || 'Not specified'}`);
	console.log(`   Scope: ${payload.scope || 'Not specified'}`);

	// Check if token is expired
	if (payload.exp) {
		const now = Math.floor(Date.now() / 1000);
		const isExpired = now >= payload.exp;
		console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
		if (isExpired) {
			console.log(`   Expired ${Math.floor((now - payload.exp) / 60)} minutes ago`);
		} else {
			console.log(`   Expires in ${Math.floor((payload.exp - now) / 60)} minutes`);
		}
	}

	// Check issuer consistency
	console.log('\n🔗 Issuer Validation:');
	if (oidcConfig && oidcConfig.issuer) {
		if (payload.iss === oidcConfig.issuer) {
			console.log('✅ Token issuer matches OIDC configuration');
		} else {
			console.log('❌ Token issuer MISMATCH:');
			console.log(`   Token issuer: ${payload.iss}`);
			console.log(`   OIDC issuer: ${oidcConfig.issuer}`);
		}
	}

	if (payload.iss === CONFIG.EXPECTED_ISSUER) {
		console.log('✅ Token issuer matches expected configuration');
	} else {
		console.log('⚠️  Token issuer differs from expected:');
		console.log(`   Token issuer: ${payload.iss}`);
		console.log(`   Expected: ${CONFIG.EXPECTED_ISSUER}`);
	}

	console.log('');
}

// Function to test OBP API endpoint
async function testOBPEndpoint(accessToken) {
	console.log('🏦 Testing OBP API Access');
	console.log('-------------------------');

	const currentUserUrl = `${CONFIG.OBP_BASE_URL}/obp/v5.1.0/users/current`;
	console.log(`Endpoint: ${currentUserUrl}`);

	try {
		const response = await fetch(currentUserUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json'
			}
		});

		console.log(`Status: ${response.status} ${response.statusText}`);

		if (response.ok) {
			const user = await response.json();
			console.log('✅ Successfully accessed OBP API');
			console.log(`   User ID: ${user.user_id}`);
			console.log(`   Email: ${user.email}`);
			console.log(`   Username: ${user.username || 'N/A'}`);
		} else {
			const errorText = await response.text();
			console.log('❌ OBP API request failed');
			console.log(`   Response: ${errorText}`);

			// Try to parse error details
			try {
				const errorData = JSON.parse(errorText);
				if (errorData.code === 401 && errorData.message.includes('OBP-20208')) {
					console.log('\n💡 This is the JWKS/Issuer mismatch error!');
					console.log('   Possible causes:');
					console.log('   - OBP API server cannot reach the JWKS endpoint');
					console.log('   - Issuer in JWT token differs from OBP configuration');
					console.log('   - JWKS URI in OIDC config differs from OBP configuration');
				}
			} catch (e) {
				// Error text is not JSON
			}
		}

		console.log('');
	} catch (error) {
		console.error('❌ Error testing OBP endpoint:', error.message);
	}
}

// Function to show configuration recommendations
function showRecommendations(oidcConfig, jwtPayload) {
	console.log('💡 Troubleshooting Recommendations');
	console.log('==================================');

	if (!oidcConfig) {
		console.log('1. ❌ OIDC configuration could not be fetched');
		console.log('   - Check if the OIDC provider is running');
		console.log('   - Verify the OBP_OAUTH_WELL_KNOWN_URL is correct');
		console.log('   - Check network connectivity');
		return;
	}

	if (jwtPayload && oidcConfig.issuer !== jwtPayload.iss) {
		console.log('1. ❌ Issuer mismatch detected');
		console.log('   - Update OBP API configuration to expect issuer:', jwtPayload.iss);
		console.log('   - OR update OIDC provider to issue tokens with issuer:', oidcConfig.issuer);
	}

	console.log('2. 🔍 Check OBP API server configuration:');
	console.log(`   - Ensure OBP API can reach: ${oidcConfig.jwks_uri}`);
	console.log(`   - Verify issuer is configured as: ${oidcConfig.issuer}`);
	console.log(`   - Check if JWKS URI is configured as: ${oidcConfig.jwks_uri}`);

	console.log('\n3. 🔧 Network connectivity checks:');
	console.log('   - Test JWKS endpoint from OBP API server:');
	console.log(`     curl ${oidcConfig.jwks_uri}`);
	console.log('   - Check firewall rules between OBP API and OIDC provider');

	console.log('\n4. 📝 Environment variables to verify:');
	console.log('   - OBP_OAUTH_WELL_KNOWN_URL');
	console.log('   - VITE_OIDC_ISSUER');
	console.log('   - PUBLIC_OBP_BASE_URL');

	console.log('\n5. 🔄 If using Docker/containers:');
	console.log('   - Ensure containers can communicate');
	console.log('   - Check if localhost/127.0.0.1 should be container names');
	console.log('   - Verify port mappings');
}

// Main function
async function main() {
	const accessToken = process.argv[2];

	// 1. Check OIDC Configuration
	const oidcConfig = await checkOIDCConfiguration();

	// 2. Check JWKS endpoint if available
	if (oidcConfig && oidcConfig.jwks_uri) {
		await checkJWKSEndpoint(oidcConfig.jwks_uri);
	}

	// 3. Analyze JWT token if provided
	let jwtPayload = null;
	if (accessToken) {
		const decoded = decodeJWT(accessToken);
		if (decoded) {
			jwtPayload = decoded.payload;
			analyzeJWT(accessToken, oidcConfig);

			// 4. Test OBP API access
			await testOBPEndpoint(accessToken);
		}
	} else {
		console.log('ℹ️  No access token provided. Add token as argument to analyze JWT claims.');
		console.log('   Usage: node debug-oauth.mjs YOUR_ACCESS_TOKEN\n');
	}

	// 5. Show recommendations
	showRecommendations(oidcConfig, jwtPayload);

	console.log('\n🔚 Debug complete');
}

// Handle errors and run
main().catch((error) => {
	console.error('💥 Unexpected error:', error);
	process.exit(1);
});
