## Administrate/List Consents Flow: Hola -> Hydra -> Hola

```
Hola (TPP app)                    OBP API                      Hydra (Auth)
─────────────                    ───────                      ────────────
1. User selects a bank
   (utility flow, no consent
    created at OBP)
        │
        │  (no OBP API call)
        │
2. Redirect to Hydra auth
   with consent_id=Utility-List-Consents
   (sentinel value), bank_id,
   api_standard=BerlinGroup
   + PKCE code_challenge
        │
        ├──────── OAuth2 login flow ──────────────────────────►
        │                                                       │
        │                                              3. User authenticates
        │                                                       │
        │◄─────── /main.html?code=...&id_token=...&state=... ──┘
        │
4. Hola /main endpoint:
   - Validates id_token
   - Exchanges code for tokens
   - Fetches /obp/v4.0.0/users/current
   - Displays consents management page
```

This is a utility flow for listing/managing existing consents. No consent is created at the OBP API. The special sentinel value `consent_id=Utility-List-Consents` signals that this is an admin/listing flow rather than a new consent creation.

Key Hola endpoint: `POST /administrate_consents` in `IndexController.java:888`.
