## UK Open Banking Consent Flow: Hola -> Hydra -> Hola

```
Hola (TPP app)                    OBP API                      Hydra (Auth)
─────────────                    ───────                      ────────────
1. User fills UK OB form
   (bank, permissions,
    transaction date range,
    expiration time)
        │
        ├──POST /endpoint.path.prefix/account-access-consents──►
        │  (with client credentials token)    │
        │                                     │
        │◄─── consent_id ────────────────────┘
        │
2. Redirect to Hydra auth
   with consent_id, bank_id,
   api_standard=UKOpenBanking
   + PKCE code_challenge
        │
        ├──────── OAuth2 login flow ──────────────────────────►
        │                                                       │
        │                                              3. User authenticates
        │                                                 Hydra grants consent
        │                                                       │
        │◄─────── /main.html?code=...&id_token=...&state=... ──┘
        │
4. Hola /main endpoint:
   - Validates id_token
     (c_hash, s_hash, at_hash)
   - Extracts consent_id from claims
   - Exchanges code for tokens
     (access_token, refresh_token)
   - Fetches /obp/v4.0.0/users/current
   - Displays accounts page
```

The entire flow stays within Hola and Hydra. No OBP-Portal pages are involved. The consent confirmation happens at the Hydra authorization screen.

Key Hola endpoint: `POST /request_consents` in `IndexController.java:294`, which creates the consent and redirects through Hydra.
