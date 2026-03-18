## VRP Consent Flow: Hola -> OBP-Portal

```
Hola (TPP app)                    OBP API                      OBP-Portal
─────────────                    ───────                      ──────────
1. User fills VRP form
   (accounts, limits, etc.)
        │
        ├──POST /obp/v5.1.0/consumer/vrp-consent-requests──►
        │                          │
        │◄─── consent_request_id ──┘
        │
2. Redirect to Hydra auth
   with consent_request_id
   as custom OAuth2 param
        │
        ├──────── OAuth2 login flow ──────────────────────────►
        │                                                       │
        │                                              3. /confirm-vrp-consent-request
        │                                                 ?CONSENT_REQUEST_ID=<id>
        │                                                 Shows VRP details, user confirms
        │                                                       │
        │                                              4. POST creates implicit consent
        │                                                 → redirect to /confirm-vrp-consent
        │                                                   ?CONSENT_ID=<id>
        │                                                       │
        │                                              5. User enters OTP
        │                                                 POST challenge to OBP API
        │                                                       │
        │◄─────── redirect back with ──────────────────────────┘
        │    CONSENT_REQUEST_ID + status=ACCEPTED
        │    (via consumer's redirect_url)
```

The OBP-Portal pages are steps 3-5 in this flow. They show the form fields alongside any errors, so you can see the full UI structure even when visiting directly from the Early Access menu (without the required query parameters from Hola).

The key Hola endpoint is `POST /obp/v5.1.0/consumer/vrp-consent-requests` in `IndexController.java:816`, which creates the consent request and then redirects through OAuth2/Hydra to eventually land on the Portal's confirm pages.
