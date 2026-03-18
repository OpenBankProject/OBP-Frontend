# OAuth2 Authentication Flow Comparison: Keycloak vs OBP-OIDC

## Overview

This document provides visual representations of how Portal authenticates with Keycloak (compliant) versus OBP-OIDC (non-compliant workaround required).

## Standard OAuth2 Flow (Keycloak)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KEYCLOAK - STANDARD OAUTH2 FLOW                      │
│                         (Fully Compliant)                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────┐                                      ┌──────────────┐
│ Portal  │                                      │  Keycloak    │
│ (Client)│                                      │ (OIDC Server)│
└────┬────┘                                      └──────┬───────┘
     │                                                  │
     │  1. GET /authorize?                             │
     │     client_id=xxx                               │
     │     redirect_uri=xxx                            │
     │     response_type=code                          │
     │     state=yyy                                   │
     ├─────────────────────────────────────────────────>
     │                                                  │
     │  2. User Login & Consent                        │
     │     (Browser interaction)                       │
     │                                                  │
     │  3. Redirect: callback?code=zzz&state=yyy      │
     <─────────────────────────────────────────────────┤
     │                                                  │
     │  4. POST /token                                 │
     │     Content-Type: application/x-www-form-url... │
     │     Authorization: Basic base64(id:secret) ✓    │
     │     ┌────────────────────────────────────┐     │
     │     │ Body:                              │     │
     │     │ grant_type=authorization_code      │     │
     │     │ code=zzz                           │     │
     │     │ redirect_uri=xxx                   │     │
     │     │ (NO client_id in body) ✓           │     │
     │     └────────────────────────────────────┘     │
     ├─────────────────────────────────────────────────>
     │                                                  │
     │                                      Validates:  │
     │                              - Basic Auth header │
     │                              - Authorization code│
     │                              - Redirect URI      │
     │                                                  │
     │  5. Response: Tokens                            │
     │     {                                           │
     │       "access_token": "eyJ...",                 │
     │       "refresh_token": "eyJ...",                │
     │       "id_token": "eyJ...",                     │
     │       "token_type": "Bearer",                   │
     │       "expires_in": 3600                        │
     │     }                                           │
     <─────────────────────────────────────────────────┤
     │                                                  │
     │  ✅ SUCCESS - Standard OAuth2/OIDC Flow         │
     │                                                  │

┌──────────────────────────────────────────────────────────────────┐
│ Key Features:                                                    │
│ ✓ Uses HTTP Basic Authentication (client_secret_basic)          │
│ ✓ Client credentials NOT in request body                        │
│ ✓ Follows RFC 6749 specification exactly                        │
│ ✓ Works with Arctic OAuth2Client without modifications          │
└──────────────────────────────────────────────────────────────────┘
```

## OBP-OIDC Flow (Requires Workaround)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   OBP-OIDC - NON-STANDARD FLOW                          │
│                    (Workaround Required)                                │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────┐                                      ┌──────────────┐
│ Portal  │                                      │  OBP-OIDC    │
│ (Client)│                                      │ (OIDC Server)│
└────┬────┘                                      └──────┬───────┘
     │                                                  │
     │  1. GET /obp-oidc/auth?                         │
     │     client_id=xxx                               │
     │     redirect_uri=xxx                            │
     │     response_type=code                          │
     │     state=yyy                                   │
     ├─────────────────────────────────────────────────>
     │                                                  │
     │  2. User Login & Consent                        │
     │     (Browser interaction)                       │
     │                                                  │
     │  3. Redirect: callback?code=zzz&state=yyy      │
     <─────────────────────────────────────────────────┤
     │                                                  │
     │  4. POST /obp-oidc/token                        │
     │     Content-Type: application/x-www-form-url... │
     │     (NO Authorization header) ✗                 │
     │     ┌────────────────────────────────────┐     │
     │     │ Body:                              │     │
     │     │ grant_type=authorization_code      │     │
     │     │ code=zzz                           │     │
     │     │ redirect_uri=xxx                   │     │
     │     │ client_id=xxx ⚠️ (WORKAROUND)      │     │
     │     │ client_secret=yyy ⚠️ (WORKAROUND)  │     │
     │     └────────────────────────────────────┘     │
     ├─────────────────────────────────────────────────>
     │                                                  │
     │                                      Validates:  │
     │                              - Reads from body   │
     │                              - Ignores Auth hdr  │
     │                              - Authorization code│
     │                              - Redirect URI      │
     │                                                  │
     │  5. Response: Tokens                            │
     │     {                                           │
     │       "access_token": "eyJ...",                 │
     │       "refresh_token": "eyJ...",                │
     │       "id_token": "eyJ...",                     │
     │       "token_type": "Bearer",                   │
     │       "expires_in": 3600                        │
     │     }                                           │
     <─────────────────────────────────────────────────┤
     │                                                  │
     │  ⚠️ SUCCESS - But using non-standard method     │
     │                                                  │

┌──────────────────────────────────────────────────────────────────┐
│ Key Issues:                                                      │
│ ✗ Requires client credentials in POST body                      │
│ ✗ Ignores HTTP Basic Authentication                             │
│ ✗ Requires custom Portal code (OAuth2ClientWithConfig)          │
│ ✗ Does not follow RFC 6749 best practices                       │
│ ⚠️ Forces client_secret_post (less secure)                      │
└──────────────────────────────────────────────────────────────────┘
```

## What Happens If Portal Uses Standard Flow with OBP-OIDC?

```
┌─────────────────────────────────────────────────────────────────────────┐
│            STANDARD ARCTIC CLIENT WITH OBP-OIDC (FAILS)                 │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────┐                                      ┌──────────────┐
│ Portal  │                                      │  OBP-OIDC    │
│(Standard│                                      │ (OIDC Server)│
│ Arctic) │                                      │              │
└────┬────┘                                      └──────┬───────┘
     │                                                  │
     │  POST /obp-oidc/token                           │
     │  Authorization: Basic base64(id:secret) ✓       │
     │  ┌──────────────────────────────────────┐       │
     │  │ Body:                                │       │
     │  │ grant_type=authorization_code        │       │
     │  │ code=zzz                             │       │
     │  │ redirect_uri=xxx                     │       │
     │  │ (NO client_id in body)               │       │
     │  └──────────────────────────────────────┘       │
     ├─────────────────────────────────────────────────>
     │                                                  │
     │                                  Processing:     │
     │                   val clientId = formData.get... │
     │                   clientId = None ✗              │
     │                                                  │
     │  ❌ ERROR Response:                             │
     │  {                                              │
     │    "error": "invalid_request",                  │
     │    "error_description":                         │
     │      "Missing required parameters for           │
     │       authorization_code grant"                 │
     │  }                                              │
     <─────────────────────────────────────────────────┤
     │                                                  │
     │  ❌ FAILURE - OBP-OIDC cannot read Basic Auth  │
     │              for authorization_code grant       │
     │                                                  │

┌──────────────────────────────────────────────────────────────────┐
│ Root Cause:                                                      │
│ OBP-OIDC only extracts client_id from request body for          │
│ authorization_code grant, not from Authorization header         │
└──────────────────────────────────────────────────────────────────┘
```

## Code Comparison

### Arctic OAuth2Client (Standard - Works with Keycloak)

```typescript
// Arctic library - node_modules/arctic/dist/client.js
async validateAuthorizationCode(tokenEndpoint, code, codeVerifier) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    if (this.redirectURI !== null) {
        body.set("redirect_uri", this.redirectURI);
    }

    // Only add client_id to body if there's no password (public client)
    if (this.clientPassword === null) {
        body.set("client_id", this.clientId);
    }

    const request = createOAuth2Request(tokenEndpoint, body);

    // Use Basic Auth if we have a password (confidential client)
    if (this.clientPassword !== null) {
        const encodedCredentials = encodeBasicCredentials(
            this.clientId,
            this.clientPassword
        );
        request.headers.set("Authorization", `Basic ${encodedCredentials}`);
    }

    return await sendTokenRequest(request);
}
```

**Result with Keycloak:** ✅ Works perfectly
**Result with OBP-OIDC:** ❌ Fails - missing client_id

---

### Portal's OAuth2ClientWithConfig (Workaround - Works with OBP-OIDC)

```typescript
// Portal's workaround - src/lib/oauth/client.ts
async validateAuthorizationCode(
    tokenEndpoint: string,
    code: string,
    codeVerifier: string | null
): Promise<any> {
    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('code', code);
    body.set('redirect_uri', this.redirectURI);

    // ALWAYS include client_id in body (WORKAROUND)
    body.set('client_id', this.clientId);

    // ALWAYS include client_secret in body if present (WORKAROUND)
    if (this.clientSecret) {
        body.set('client_secret', this.clientSecret);
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

**Result with Keycloak:** ✅ Works (Keycloak accepts both methods)
**Result with OBP-OIDC:** ✅ Works (OBP-OIDC requires this method)

---

### OBP-OIDC TokenEndpoint (The Problem)

```scala
// OBP-OIDC - src/main/scala/com/tesobe/oidc/endpoints/TokenEndpoint.scala
private def handleTokenRequest(req: Request[IO], form: UrlForm): IO[Response[IO]] = {
    val formData = form.values.view.mapValues(_.headOption.getOrElse("")).toMap

    val grantType = formData.get("grant_type")
    val code = formData.get("code")
    val redirectUri = formData.get("redirect_uri")

    // ❌ PROBLEM: Only reads from form body, not from Authorization header
    val clientId = formData.get("client_id")
    val refreshToken = formData.get("refresh_token")

    grantType match {
        case Some("authorization_code") =>
            (code, redirectUri, clientId) match {
                case (Some(authCode), Some(redirectUriValue), Some(clientIdValue)) =>
                    // ✓ Has client_id from body
                    processAuthorizationCodeGrant(authCode, redirectUriValue, clientIdValue)
                case _ =>
                    // ✗ Missing client_id - returns error
                    BadRequest(OidcError("invalid_request",
                        Some("Missing required parameters")).asJson)
            }
        // ... other cases
    }
}
```

**Problem:** Never calls `extractBasicAuthCredentials` for authorization_code grant!

Compare with client_credentials grant (which DOES work correctly):

```scala
case Some("client_credentials") =>
    // ✓ CORRECT: Tries both authentication methods
    val credentials = extractBasicAuthCredentials(req).orElse {
        (formData.get("client_id"), formData.get("client_secret")) match {
            case (Some(id), Some(secret)) => Some((id, secret))
            case _ => None
        }
    }
    // ... process grant
```

## Summary Table

| Aspect                            | Keycloak            | OBP-OIDC              | OAuth 2.0 Spec                    |
| --------------------------------- | ------------------- | --------------------- | --------------------------------- |
| **client_secret_basic** support   | ✅ Full             | ❌ Broken (auth code) | Required for confidential clients |
| **client_secret_post** support    | ✅ Full             | ✅ Works              | Alternative method                |
| **Discovery doc accuracy**        | ✅ Accurate         | ❌ Misleading         | Must be accurate                  |
| **Arctic client compatibility**   | ✅ Works out of box | ❌ Requires override  | Should work                       |
| **Consistent across grant types** | ✅ Yes              | ❌ No                 | Required                          |
| **Security best practices**       | ✅ Follows          | ⚠️ Partial            | Critical                          |

## Fix Required in OBP-OIDC

To achieve OAuth 2.0 compliance, OBP-OIDC needs to:

1. Extract client credentials from **both** sources (Basic Auth OR body)
2. Apply this consistently to **all** grant types
3. Match the behavior already implemented for `client_credentials` grant

**Proposed fix:**

```scala
private def handleTokenRequest(req: Request[IO], form: UrlForm): IO[Response[IO]] = {
    val formData = form.values.view.mapValues(_.headOption.getOrElse("")).toMap

    // ✅ EXTRACT CLIENT CREDENTIALS FROM BOTH SOURCES
    val clientCredentials = extractBasicAuthCredentials(req).orElse {
        formData.get("client_id").map { id =>
            (id, formData.get("client_secret").getOrElse(""))
        }
    }

    val grantType = formData.get("grant_type")
    val code = formData.get("code")
    val redirectUri = formData.get("redirect_uri")

    grantType match {
        case Some("authorization_code") =>
            // ✅ USE EXTRACTED CREDENTIALS
            (code, redirectUri, clientCredentials) match {
                case (Some(authCode), Some(redirectUriValue), Some((clientId, _))) =>
                    processAuthorizationCodeGrant(authCode, redirectUriValue, clientId)
                case _ =>
                    BadRequest(OidcError("invalid_request",
                        Some("Missing required parameters")).asJson)
            }
        // ... other cases
    }
}
```

This single change would:

- ✅ Fix OAuth 2.0 compliance
- ✅ Allow Portal to use standard Arctic client
- ✅ Support both authentication methods
- ✅ Maintain backward compatibility
- ✅ Match Keycloak's behavior

## References

- **RFC 6749 Section 2.3**: Client Authentication
- **RFC 6749 Section 3.2**: Token Endpoint
- **OpenID Connect Core 1.0 Section 9**: Client Authentication
- **Arctic OAuth Library**: https://github.com/pilcrowOnPaper/arctic

---

**Created:** 2025-01-20
**Last Updated:** 2025-01-20
**Status:** Active Documentation - OBP-OIDC Non-Compliance Confirmed
