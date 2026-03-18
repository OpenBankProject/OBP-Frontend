## OBP Consent Request Flow: Hola -> Hydra -> Hola

```
Hola (TPP app)                    OBP API                      Hydra (Auth)
─────────────                    ───────                      ────────────
1. User fills OBP consent form
   (bank, time-to-live,
    valid-from date,
    everything indicator OR
    up to 2 account access rows
    with routing scheme/address
    and view ID)
        │
        ├──POST /obp/v5.1.0/consumer/consent-requests─────────►
        │  (with client credentials token)    │
        │                                     │
        │◄─── consent_request_id ────────────┘
        │
2. Redirect to Hydra auth
   with consent_request_id,
   consent_id=None, bank_id,
   time_to_live_in_seconds,
   valid_from,
   everything_indicator,
   api_standard=OBP
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
   - Exchanges code for tokens
   - Fetches /obp/v4.0.0/users/current
   - Displays accounts page
```

The entire flow stays within Hola and Hydra. No OBP-Portal pages are involved. The consent confirmation happens at the Hydra authorization screen.

Note: This flow uses `consent_request_id` (not `consent_id`) and sets `consent_id=None`, distinguishing it from the UK/BG flows which use `consent_id` directly.

Key Hola endpoint: `POST /request_consents_obp` in `IndexController.java:629`, which creates the consent request and redirects through Hydra.
