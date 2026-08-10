# Onboarding Google OIDC login (OBP Portal — frontend / BFF side)

How to add **"Sign in with Google"** to the OBP Portal (`apps/portal`, a
SvelteKit app). This is the client/BFF half; the OBP-API backend must be
configured to accept the resulting tokens — see the companion runbook
`GOOGLE_OIDC_ONBOARDING.md` in the OBP-API repo.

The Portal acts as an OIDC **relying party** running a server-side
authorization-code flow. Google is already a registered provider strategy
(`src/lib/oauth/providerFactory.ts` → `GoogleStrategy`) **and the callback
already handles Google's opaque access tokens** (see §4), so onboarding is
configuration only — no code change.

> Verified working: a Google login completes end-to-end and OBP resolves the
> user as `provider: https://accounts.google.com`.

> Architecture note: differs from API Explorer II. The Portal uses SvelteKit
> server routes, **cookie-based `state` (no PKCE)**, and the `arctic`
> `OAuth2Client`. Provider discovery comes from OBP
> `GET /obp/v5.1.0/well-known` via `src/lib/oauth/providerManager.ts`.

---

## 1. Prerequisites

- An OBP-API instance that advertises `google` at `/obp/v5.1.0/well-known` and
  validates Google id_tokens (`oauth2.oidc_provider` includes `google`,
  `oauth2.jwk_set.url` includes Google's JWKS, `oauth2.google.allowed_audiences`
  lists this app's client ID). See the OBP-API runbook.
- A Google Cloud project with the OAuth consent screen configured.

## 2. Create Google OAuth credentials

In [Google Cloud Console](https://console.cloud.google.com/) →
**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**
- **Authorized redirect URI**: must exactly match `APP_CALLBACK_URL`. All
  providers in the Portal share this one callback, so for every environment
  register the `APP_CALLBACK_URL` value, e.g.
  - local: `http://localhost:5174/login/obp/callback`
  - prod: `https://<your-host>/login/obp/callback`

Note the **Client ID** (`...apps.googleusercontent.com`) and **Client secret**.

> The Client ID is the value the OBP-API operator must add to
> `oauth2.google.allowed_audiences`.

> The callback path is `/login/obp/callback` for **all** providers (it's the
> shared `APP_CALLBACK_URL`), not a per-provider path. The login *initiation*
> route is per-provider (`/login/google`), but Google redirects back to
> `APP_CALLBACK_URL`.

## 3. Configure environment variables

`GoogleStrategy.initialize()` throws unless both Google vars are set. Add to
your `apps/portal/.env` (the keys are already stubbed in `.env.example`):

```bash
# Google OIDC (used when OBP /well-known advertises a "google" provider)
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret

# Shared across providers — must match the Google Authorized redirect URI
APP_CALLBACK_URL=http://localhost:5174/login/obp/callback

# OBP-API base the Portal reads /well-known and /users/current from
PUBLIC_OBP_BASE_URL=http://localhost:8080
```

These are **private** server-side env vars (`$env/dynamic/private`) — the secret
never reaches the browser.

## 4. How the flow works (existing code)

1. **Discovery** — `providerManager.ts` calls OBP `/obp/v5.1.0/well-known` and,
   for each advertised provider it has a strategy + credentials for, fetches the
   provider's `.well-known/openid-configuration` and builds an
   `OAuth2ClientWithConfig` (Google issuer:
   `https://accounts.google.com/.well-known/openid-configuration`).
2. **Login** — `GET /login/google` (`login/[provider]/+server.ts`) generates
   `state`, stores it in the `obp_oauth_state` cookie as `state:provider`, and
   redirects to Google's `authorization_endpoint` with
   `scope=openid email profile`. The `redirect_uri` is `APP_CALLBACK_URL`.
3. **Callback** — `GET /login/obp/callback`
   (`login/obp/callback/+server.ts`, logger `OBPLoginCallback`) validates the
   `state` cookie, exchanges the code for tokens, then calls OBP
   `/obp/v5.1.0/users/current` and stores the user + tokens in the session.
4. **Opaque-token handling (already implemented)** — Google access tokens are
   opaque (`ya29...`) and can't be validated by OBP, so the callback sends the
   **id_token** (a JWT) to OBP for Google:

   ```ts
   // login/obp/callback/+server.ts
   const obpAccessToken = provider === 'google' ? idToken : tokens.accessToken();
   ```

   The refresh path does the same (`sessionHelper.ts`,
   `provider === 'google' ? tokens.idToken() : tokens.accessToken()`), so
   re-issued Google sessions also send the id_token.

## 5. Verify

1. Restart the Portal; logs should show the Google client initialized from
   `/well-known` (`Successfully initialized OAuth2 provider: google`).
2. Visit `/login`, click **Sign in with Google**, complete consent.
3. Logs should show `[OBPLoginCallback] Successfully fetched current user from
   OBP ... provider: google` and a session created. The user object's
   `provider` is `https://accounts.google.com`.

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `google` provider not found / not offered | OBP `/well-known` doesn't advertise it, or `GOOGLE_OAUTH_CLIENT_ID/SECRET` unset (strategy throws) |
| `redirect_uri_mismatch` from Google | Google Console redirect URI ≠ `APP_CALLBACK_URL` (must be `.../login/obp/callback`) |
| OBP `OBP-20214` after Google consent | id_token not sent (check the `provider === 'google'` branch), or OBP `oauth2.jwk_set.url` lacks Google's JWKS |
| OBP `OBP-20217` | this app's Client ID missing from `oauth2.google.allowed_audiences` on OBP |
| OBP `OBP-20218` | `google` missing from `oauth2.oidc_provider` on OBP |

## 7. Notes / follow-ups

- **Two callback files exist.** The active one is `login/obp/callback`
  (the shared `APP_CALLBACK_URL`) and it has the Google id_token swap. A second,
  generic `login/[provider]/callback/+server.ts` does **not** have the swap and
  is unused under the current shared-callback config — if it is ever wired up
  (per-provider callbacks), it would need the same `provider === 'google'`
  handling. Worth consolidating to avoid drift.
- **No PKCE.** The flow uses `state` only (`code_verifier` is passed as `null`).
  Google supports PKCE; adding `S256` PKCE would harden the flow.
- **`nonce`.** Not currently sent/validated; worth adding since the id_token is
  consumed as an auth credential.

---

**Related:** `OAUTH2-COMPLIANCE-ANALYSIS.md`, `src/lib/oauth/providerFactory.ts`,
`src/lib/oauth/providerManager.ts`,
`src/routes/login/obp/callback/+server.ts`, `src/lib/oauth/sessionHelper.ts`,
OBP-API `GOOGLE_OIDC_ONBOARDING.md` and `OAUTH2_IDENTITY_PROVIDERS.md`.
