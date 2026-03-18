# OAuth2/OIDC Compliance Analysis: Keycloak vs OBP-OIDC

## Executive Summary

**Finding:** OBP-OIDC is **not fully compliant** with OAuth 2.0/OIDC specifications for the `authorization_code` grant type. Specifically, it does not properly support the `client_secret_basic` authentication method despite advertising it in its discovery document.

**Impact:** Portal requires a workaround to authenticate with OBP-OIDC by always sending client credentials in the POST body (`client_secret_post`) instead of using HTTP Basic authentication, which is the standard approach used by compliant OIDC providers like Keycloak.

## Background

### OAuth 2.0 Client Authentication Methods (RFC 6749 Section 2.3)

The OAuth 2.0 specification defines multiple ways for clients to authenticate with the authorization server:

1. **`client_secret_basic`**: Client credentials sent via HTTP Basic authentication

   - Authorization header: `Basic base64(client_id:client_secret)`
   - Client credentials should NOT be in the request body

2. **`client_secret_post`**: Client credentials sent in the POST body

   - `client_id` and `client_secret` as form parameters

3. **`none`**: Public clients without a client secret
   - Only `client_id` in the form body

## Technical Analysis

### Arctic OAuth2Client (Standard Implementation)

The Portal uses the Arctic library's `OAuth2Client` as the base class. Arctic implements OAuth 2.0 correctly:

```javascript
// From node_modules/arctic/dist/client.js
async validateAuthorizationCode(tokenEndpoint, code, codeVerifier) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    if (this.redirectURI !== null) {
        body.set("redirect_uri", this.redirectURI);
    }

    // KEY: Only includes client_id in body if there's no password
    if (this.clientPassword === null) {
        body.set("client_id", this.clientId);
    }

    const request = createOAuth2Request(tokenEndpoint, body);

    // KEY: Uses Basic Auth when password exists
    if (this.clientPassword !== null) {
        const encodedCredentials = encodeBasicCredentials(this.clientId, this.clientPassword);
        request.headers.set("Authorization", `Basic ${encodedCredentials}`);
    }

    return await sendTokenRequest(request);
}
```

**Arctic's Behavior:**

- ✅ If `clientPassword` exists: Uses HTTP Basic Auth (`client_secret_basic`)
- ✅ If `clientPassword` is null: Uses body params only (`none`)
- ✅ Follows OAuth 2.0 specification correctly

### Portal's Workaround for OBP-OIDC

Portal overrides the `validateAuthorizationCode` method to work around OBP-OIDC's limitations:

```typescript
// From src/lib/oauth/client.ts
async validateAuthorizationCode(tokenEndpoint: string, code: string, codeVerifier: string | null): Promise<any> {
    logger.debug('Validating authorization code with explicit client_id');

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', this.redirectURI);
    body.set('client_id', this.clientId);  // ALWAYS in body

    if (this.clientSecret) {
        body.set('client_secret', this.clientSecret);  // ALSO in body
    }

    if (codeVerifier) {
        body.set('code_verifier', codeVerifier);
    }

    // NO Basic Auth header - everything in body
    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        body: body.toString()
    });

    // ... handle response
}
```

**Portal's Workaround Behavior:**

- ⚠️ ALWAYS includes `client_id` in the body
- ⚠️ ALWAYS includes `client_secret` in the body (if present)
- ⚠️ NEVER uses HTTP Basic Auth
- ⚠️ Effectively forces `client_secret_post` authentication method

### OBP-OIDC Implementation Issues

#### Discovery Document Claims

OBP-OIDC advertises support for multiple authentication methods:

```scala
// From src/main/scala/com/tesobe/oidc/endpoints/DiscoveryEndpoint.scala
token_endpoint_auth_methods_supported =
    List("client_secret_post", "client_secret_basic", "none")
```

**Claims:** Supports all three standard authentication methods ✓

#### Actual Implementation

However, the token endpoint implementation tells a different story:

```scala
// From src/main/scala/com/tesobe/oidc/endpoints/TokenEndpoint.scala
private def handleTokenRequest(req: Request[IO], form: UrlForm): IO[Response[IO]] = {
    val formData = form.values.view.mapValues(_.headOption.getOrElse("")).toMap

    val grantType = formData.get("grant_type")
    val code = formData.get("code")
    val redirectUri = formData.get("redirect_uri")
    val clientId = formData.get("client_id")  // Only reads from form body!
    val refreshToken = formData.get("refresh_token")

    grantType match {
        case Some("authorization_code") =>
            (code, redirectUri, clientId) match {
                case (Some(authCode), Some(redirectUriValue), Some(clientIdValue)) =>
                    // Requires clientId from form body
                    processAuthorizationCodeGrant(authCode, redirectUriValue, clientIdValue)
                case _ =>
                    BadRequest(OidcError("invalid_request",
                        Some("Missing required parameters for authorization_code grant")).asJson)
            }
        // ... other grant types
    }
}
```

**Problem:** For `authorization_code` grant, OBP-OIDC:

- ❌ Only extracts `client_id` from form body
- ❌ Does NOT call `extractBasicAuthCredentials` for this grant type
- ❌ Will fail if client credentials are sent via Basic Auth
- ❌ Does not implement `client_secret_basic` despite advertising it

#### Inconsistent Implementation

OBP-OIDC DOES handle Basic Auth correctly for `client_credentials` grant:

```scala
case Some("client_credentials") =>
    // Extract client credentials from Basic Auth header OR form data
    val credentials = extractBasicAuthCredentials(req).orElse {
        (formData.get("client_id"), formData.get("client_secret")) match {
            case (Some(id), Some(secret)) => Some((id, secret))
            case _ => None
        }
    }
```

This shows that:

- ✅ OBP-OIDC knows how to extract Basic Auth credentials
- ✅ `client_credentials` grant properly supports both authentication methods
- ❌ But this logic is NOT applied to `authorization_code` grant

## Comparison with Keycloak

### Keycloak (Compliant OIDC Provider)

Keycloak is a mature, fully compliant OIDC provider that:

1. ✅ Properly supports `client_secret_basic` authentication
2. ✅ Properly supports `client_secret_post` authentication
3. ✅ Handles both methods for ALL grant types consistently
4. ✅ Portal can use the standard Arctic OAuth2Client without modifications

When Portal authenticates with Keycloak:

- Uses Arctic's standard `validateAuthorizationCode` method
- Sends credentials via HTTP Basic Auth
- Works perfectly without any workarounds

### OBP-OIDC (Non-Compliant)

OBP-OIDC has partial OIDC compliance:

1. ❌ Does NOT properly support `client_secret_basic` for authorization_code
2. ✅ Does support `client_secret_post` for authorization_code
3. ✅ Does support both methods for client_credentials grant
4. ⚠️ Advertises support it doesn't fully implement
5. ❌ Portal requires custom workaround to function

## Compliance Issues Summary

| Aspect                                       | Keycloak    | OBP-OIDC      | Spec Compliant? |
| -------------------------------------------- | ----------- | ------------- | --------------- |
| Discovery document accuracy                  | ✅ Accurate | ❌ Inaccurate | OBP-OIDC: No    |
| `client_secret_basic` for authorization_code | ✅ Works    | ❌ Broken     | OBP-OIDC: No    |
| `client_secret_post` for authorization_code  | ✅ Works    | ✅ Works      | Both: Yes       |
| `client_secret_basic` for client_credentials | ✅ Works    | ✅ Works      | Both: Yes       |
| `client_secret_post` for client_credentials  | ✅ Works    | ✅ Works      | Both: Yes       |
| Consistent authentication across grant types | ✅ Yes      | ❌ No         | OBP-OIDC: No    |

## Recommended Fixes for OBP-OIDC

### Option 1: Fix the Implementation (Recommended)

Update `handleTokenRequest` to extract client credentials from both sources:

```scala
private def handleTokenRequest(req: Request[IO], form: UrlForm): IO[Response[IO]] = {
    val formData = form.values.view.mapValues(_.headOption.getOrElse("")).toMap

    // Extract client credentials from Basic Auth OR form body
    val clientCredentials = extractBasicAuthCredentials(req).orElse {
        formData.get("client_id").map { id =>
            (id, formData.get("client_secret").getOrElse(""))
        }
    }

    val grantType = formData.get("grant_type")
    val code = formData.get("code")
    val redirectUri = formData.get("redirect_uri")
    val refreshToken = formData.get("refresh_token")

    grantType match {
        case Some("authorization_code") =>
            (code, redirectUri, clientCredentials) match {
                case (Some(authCode), Some(redirectUriValue), Some((clientId, clientSecret))) =>
                    processAuthorizationCodeGrant(authCode, redirectUriValue, clientId)
                case _ =>
                    BadRequest(OidcError("invalid_request",
                        Some("Missing required parameters")).asJson)
            }
        // ... rest of implementation
    }
}
```

This would:

- ✅ Support both `client_secret_basic` and `client_secret_post`
- ✅ Make discovery document accurate
- ✅ Allow Portal to use standard Arctic client
- ✅ Achieve OAuth 2.0/OIDC compliance
- ✅ Maintain backward compatibility

### Option 2: Update Discovery Document

If fixing the implementation is not feasible, update the discovery document to be honest:

```scala
token_endpoint_auth_methods_supported =
    List("client_secret_post", "none")  // Remove "client_secret_basic"
```

This would:

- ⚠️ Still require Portal workaround
- ✅ Make documentation accurate
- ⚠️ Acknowledge non-compliance
- ✅ Set correct client expectations

## Impact on Portal

### Current Situation

Portal maintains a **custom workaround** in `OAuth2ClientWithConfig` class:

**Benefits:**

- ✅ Works with both Keycloak and OBP-OIDC
- ✅ Provides consistent behavior across providers

**Drawbacks:**

- ❌ Deviates from OAuth 2.0 best practices
- ❌ Doesn't use HTTP Basic Auth (less secure in some contexts)
- ❌ Requires maintaining custom OAuth client code
- ❌ Can't leverage Arctic library updates directly
- ❌ May not work with other OIDC providers

### If OBP-OIDC is Fixed

Portal could:

1. Remove the `validateAuthorizationCode` override
2. Use Arctic's standard `OAuth2Client` directly
3. Simplify the codebase
4. Work with any compliant OIDC provider
5. Benefit from Arctic library improvements automatically

### Code Locations

Files involved in the workaround:

- **`src/lib/oauth/client.ts`**: Contains `OAuth2ClientWithConfig` with the workaround
- **`src/lib/oauth/providerFactory.ts`**: Creates OAuth clients for both providers
- **`src/routes/login/obp/callback/+server.ts`**: Uses the OAuth client

## Security Considerations

### HTTP Basic Auth vs Body Parameters

**HTTP Basic Auth (`client_secret_basic`):**

- ✅ Client secret not in URL or easily logged request bodies
- ✅ Standard practice for confidential clients
- ✅ Easier to filter from logs
- ✅ Recommended by OAuth 2.0 specification

**Body Parameters (`client_secret_post`):**

- ⚠️ Client secret in request body (less secure)
- ✅ Works with all clients/libraries
- ⚠️ May appear in request logs
- ⚠️ Alternative method, not preferred

Both methods work over HTTPS, but Basic Auth is generally preferred for confidential clients.

## Testing Recommendations

### For OBP-OIDC Development

To verify OAuth 2.0 compliance, test:

1. **Authorization Code Flow with Basic Auth:**

   ```bash
   curl -X POST http://localhost:9000/obp-oidc/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -H "Authorization: Basic $(echo -n 'client_id:client_secret' | base64)" \
     -d "grant_type=authorization_code" \
     -d "code=AUTH_CODE" \
     -d "redirect_uri=http://localhost:5174/login/obp/callback"
   ```

   **Expected:** Should work (currently fails)

2. **Authorization Code Flow with Body Params:**

   ```bash
   curl -X POST http://localhost:9000/obp-oidc/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "code=AUTH_CODE" \
     -d "redirect_uri=http://localhost:5174/login/obp/callback" \
     -d "client_id=CLIENT_ID" \
     -d "client_secret=CLIENT_SECRET"
   ```

   **Expected:** Should work (currently works)

3. **Verify both methods work for all grant types**

## Conclusion

**OBP-OIDC is not fully OAuth 2.0/OIDC compliant** because:

1. It advertises support for `client_secret_basic` but doesn't implement it for authorization_code grant
2. It implements authentication methods inconsistently across grant types
3. It requires clients to use workarounds to function properly

**Portal's workaround is necessary** to authenticate with OBP-OIDC but:

1. It forces Portal to use non-standard authentication approach
2. It prevents Portal from working with fully compliant OIDC providers that only accept Basic Auth
3. It adds maintenance burden to Portal codebase

**Recommendation:** Fix OBP-OIDC's token endpoint to properly support `client_secret_basic` for all grant types, which would:

- Achieve OAuth 2.0 compliance
- Allow Portal to remove workarounds
- Enable OBP-OIDC to work with any OAuth 2.0 compliant client
- Improve security posture
- Match the behavior of mature OIDC providers like Keycloak

## References

- [RFC 6749 - OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 6749 Section 2.3 - Client Authentication](https://datatracker.ietf.org/doc/html/rfc6749#section-2.3)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Arctic OAuth Library](https://github.com/pilcrowOnPaper/arctic)
- [Keycloak Documentation](https://www.keycloak.org/documentation)

---

**Document Version:** 1.0
**Date:** 2025-01-20
**Author:** Technical Analysis
**Status:** Active Issue - OBP-OIDC Non-Compliance Confirmed
