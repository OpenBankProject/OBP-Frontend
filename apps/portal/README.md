41111## Getting Started

### Install dependencies

```bash
npm install
```

### Configure Environment

copy .env.example to .env and fill out as needed

Make sure you set the `ORIGIN` variable to the domain that you are deploying to i.e. https://obp-portal.openbankproject.com or something like that

For a complete list of environment variables and their usage, see [Environment Variables Documentation](./docs/environment-variables.md).

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# To run on a specific port use:
# Note: Another port will be used if the target is port is already in use
npm run dev -- --port 5174

# To force the use of a port use the following (an error will be thrown if the target port is already in use) use:
npm run dev -- --port 5174 --strictPort

# To see other server options see : https://vite.dev/config/server-options (note remove the word server.)

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deploying in production

Make sure to deploy the latest commit/docker image.

Look carefully at the `.env.example` provided, Copy to `.env` (`.env-docker`) and fill out the variables as needed.

A common mistake is to not change the `APP_CALLBACK_URL`, which should be the domain that the portal is deployed to, not `localhost`.

## Troubleshooting

### OAuth Token Refresh Failures

If you encounter errors like:

```
OAuth2RequestError: OAuth request error: invalid_grant
code: 'invalid_grant',
description: 'Token is not active'
```

**What's happening:**

- User's refresh token has expired or become invalid (normal OAuth behavior)
- System cannot automatically renew the session
- User needs to log in again
- Now logged as INFO instead of ERROR since this is expected behavior

**Common causes:**

1. **Refresh token expiration** - OAuth providers set token lifetimes (e.g., 30 days)
2. **Token revocation** - User logged out from another session
3. **Provider security policy** - Tokens invalidated after inactivity
4. **Configuration mismatch** - OAuth client settings incorrect

**Solutions:**

1. **Check your environment configuration** - Verify OAuth settings in `.env`
2. **Clear cached sessions** - Remove `.svelte-kit/output` and rebuild
3. **Use fresh credentials** - Re-authenticate with valid tokens
4. **This is now logged as INFO** - No longer appears as ERROR in logs since it's normal OAuth behavior

**Quick fixes:**

```bash
# Clear cached sessions
rm -rf .svelte-kit/output/server/chunks
npm run build

# Restart development server
npm run dev
```

**Note:** As of recent updates, token refresh failures are now logged as INFO messages rather than ERROR messages, since expired tokens are part of normal OAuth security behavior.

### Opey Chat JWT Expiration

If you encounter errors like:

```
OBP-20204: Bad JWT error. Expired JWT <- com.nimbusds.jwt.proc.BadJWTException: Expired JWT
Error creating authenticated Opey session: OBPRequestError: OBP-20204
```

**What's happening:**

- The JWT token used for Opey chat integration has expired (normal behavior)
- System cannot create authenticated chat session with expired JWT
- User needs to re-authenticate to use chat features
- Now logged as INFO instead of ERROR since this is expected JWT lifecycle

**Common causes:**

1. **JWT expiration** - Consent JWTs have their own expiration times (typically 1 hour)
2. **Clock skew** - Server time differences can cause premature expiration
3. **User consent revoked** - User may have revoked consent from another session
4. **Session timeout** - Long periods of inactivity

**Solutions:**

1. **User re-authentication** - User should log out and log back in
2. **Check system clocks** - Ensure server times are synchronized
3. **This is now logged as INFO** - JWT expiration is normal security behavior
4. **Fallback to anonymous chat** - System gracefully falls back to anonymous mode

**Quick fixes:**

```bash
# For development - restart with fresh session
npm run dev

# User should log out and back in to get fresh JWTs
```

## Theming

Themes should be created using the (skeleton UI designer)[https://themes.skeleton.dev/themes/create]. Then you can replace obp-theme.css with your file.


## Logging Configuration

### Username Logging for Opey Communication

The OBP-Portal automatically logs the username from consent JWTs when communicating with Opey. This feature helps with monitoring and debugging by showing which user is making requests to the Opey service.

The logging includes:

- Function name that created the log entry
- Username extracted from the consent JWT token (with explicit field identification)
- Opey session creation details
- Success/failure status of operations

Example log output:

```
INFO [2025-08-13T15:03:36.690Z] [INFO] [OBPIntegrationService] getOrCreateOpeyConsent says: Created new consent JWT for user: 91be7e0b-bf6b-4476-8a89-75850a11313b
INFO [2025-08-13T15:03:36.691Z] [INFO] [OpeyAuthServer] _getAuthenticatedSession says: Sending consent JWT to Opey for user: 91be7e0b-bf6b-4476-8a89-75850a11313b
INFO [2025-08-13T15:03:36.692Z] [INFO] [OpeyAuthServer] _getAuthenticatedSession says: Making request to http://localhost:5000/create-session with consent for user: 91be7e0b-bf6b-4476-8a89-75850a11313b
INFO [2025-08-13T15:03:36.720Z] [INFO] [OpeyAuthServer] _getAuthenticatedSession says: Successfully created authenticated Opey session for user: 91be7e0b-bf6b-4476-8a89-75850a11313b
```

### JWT User Identification Fields

The system attempts to extract user identifiers from these JWT fields in order (prioritizing human-readable identifiers):

1. `email`
2. `name`
3. `preferred_username`
4. `username`
5. `user_name`
6. `login`
7. `sub`
8. `user_id`

The system will log which field was used for user identification:

```
INFO [timestamp] [INFO] [JWTUtils] extractUsernameFromJWT says: User identifier extracted from JWT field 'email': john.doe@example.com
INFO [timestamp] [INFO] [JWTUtils] extractUsernameFromJWT says: User identifier extracted from JWT field 'sub': 91be7e0b-bf6b-4476-8a89-75850a11313b
```

### Function Name Prefixes

All log messages include the service/function name that generated the log for easier debugging:

- `extractUsernameFromJWT says:` - JWT user identifier extraction logs
- `getOrCreateOpeyConsent says:` - Consent JWT creation/retrieval logs
- `_getAuthenticatedSession says:` - Authenticated session creation logs
- `_getAnonymousSession says:` - Anonymous session creation logs
- `ConsentSessionService says:` - Session service operation logs

### Development vs Production Logging

When no user identifier can be found in the JWT, the system will log all available JWT fields to help with debugging. The system prioritizes human-readable identifiers like email addresses and display names over system identifiers like UUIDs.

Make sure that the `APP_CALLBACK_URL` is registered with the OAuth2/OIDC provider, so that it will properly redirect. Without this the Portal will not work.
