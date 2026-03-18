## Berlin Group Consent Flow: Hola -> Hydra -> Hola

```
Hola (TPP app)                    OBP API                      Hydra (Auth)
─────────────                    ───────                      ────────────
1. User fills BG form
   (bank, IBANs, permissions,
    recurring indicator,
    frequency per day,
    expiration time)
        │
        ├──POST /berlin-group/v1.3/consents────────────────────►
        │  (with client credentials token)    │
        │                                     │
        │◄─── consent_id ────────────────────┘
        │
2. Redirect to Hydra auth
   with consent_id, bank_id,
   iban (comma-separated),
   recurring_indicator,
   frequency_per_day,
   expiration_time,
   api_standard=BerlinGroup
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
   - Fetches /berlin-group/v1.3/consents/{CONSENT_ID}
     (gets frequencyPerDay, consentStatus,
      validUntil, recurringIndicator)
   - Displays accounts page with BG consent details
```

The entire flow stays within Hola and Hydra. No OBP-Portal pages are involved. The consent confirmation happens at the Hydra authorization screen.

Key Hola endpoint: `POST /request_consents_bg` in `IndexController.java:518`, which creates the Berlin Group consent and redirects through Hydra.
