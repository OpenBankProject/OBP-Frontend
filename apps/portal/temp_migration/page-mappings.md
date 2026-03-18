# OBP-API to OBP-Portal Page Mappings

This document provides a comprehensive mapping of HTML pages from OBP-API (Lift Web framework) to their equivalents in OBP-Portal (SvelteKit).

## Quick Reference Table

| OBP-API Path | OBP-API HTML File | OBP-Portal Equivalent | Status | Notes |
|-------------|-------------------|----------------------|--------|-------|
| `/index` | index.html | `/` (root +page.svelte) | ✅ Replaced | Home page |
| `/index-en` | index-en.html | `/` (root +page.svelte) | ✅ Replaced | English version, now i18n handled differently |
| `/static` | static.html | N/A | ❌ No equivalent | Static content page |
| `/sdks` | sdks.html | `/about` (partial) | ⚠️ Partial | SDK info might be in about page |
| `/consents` | consents.html | `/user/consents` | ✅ Replaced | User consents management |
| `/user-information` | user-information.html | `/user` | ✅ Replaced | User profile/information |
| `/user-invitation` | user-invitation.html | `/user-invitation` | ✅ Equivalent exists | User invitation handling |
| `/user-invitation-info` | user-invitation-info.html | `/user-invitation` | ✅ Integrated | Likely integrated into main invitation page |
| `/user-invitation-invalid` | user-invitation-invalid.html | `/user-invitation` | ✅ Integrated | Error handling in main invitation page |
| `/user-invitation-warning` | user-invitation-warning.html | `/user-invitation` | ✅ Integrated | Warning handling in main invitation page |
| `/oauth/authorize` | oauth/authorize.html | `/login/[provider]` | ✅ Replaced | OAuth authorization flow |
| `/consent` | (OAuth consent) | `/login/[provider]/callback` | ✅ Replaced | OAuth consent handling |
| `/consent-screen` | consent-screen.html | `/login/[provider]/callback` | ✅ Replaced | Consent screen during OAuth |
| `/terms-and-conditions` | terms-and-conditions.html | N/A | ❌ No equivalent | Terms and conditions page |
| `/privacy-policy` | privacy-policy.html | N/A | ❌ No equivalent | Privacy policy page |
| `/already-logged-in` | already-logged-in.html | N/A | ❌ No equivalent | Already logged in message |
| `/dummy-user-tokens` | dummy-user-tokens.html | N/A | ❌ No equivalent | Development/testing page |
| `/otp` | otp.html | N/A | ❌ No equivalent | OTP validation page |
| `/introduction` | introduction.html | `/about` | ⚠️ Partial | Introduction/about content |
| `/create-sandbox-account` | create-sandbox-account.html | N/A | ❌ No equivalent | Sandbox account creation |
| `/admin/consumers` | (Consumer Admin) | `/user/consumers` | ✅ Replaced | Consumer management (now user-scoped) |
| `/confirm-bg-consent-request` | confirm-bg-consent-request.html | N/A | ❌ No equivalent | Berlin Group consent confirmation |
| `/confirm-bg-consent-request-sca` | confirm-bg-consent-request-sca.html | N/A | ❌ No equivalent | Berlin Group SCA consent |
| `/confirm-bg-consent-request-redirect-uri` | confirm-bg-consent-request-redirect-uri.html | N/A | ❌ No equivalent | Berlin Group consent redirect |
| `/confirm-vrp-consent-request` | confirm-vrp-consent-request.html | N/A | ❌ No equivalent | VRP consent request |
| `/confirm-vrp-consent` | confirm-vrp-consent.html | N/A | ❌ No equivalent | VRP consent confirmation |
| `/add-user-auth-context-update-request` | add-user-auth-context-update-request.html | N/A | ❌ No equivalent | User auth context update |
| `/confirm-user-auth-context-update-request` | confirm-user-auth-context-update-request.html | N/A | ❌ No equivalent | User auth context confirmation |
| `/debug` | debug.html | N/A | ❌ No equivalent | Debug page |
| `/debug/awake` | debug/awake.html | `/status` | ⚠️ Similar | Health check/status |
| `/debug/debug-basic` | debug/debug-basic.html | N/A | ❌ No equivalent | Debug utilities |
| `/debug/debug-default-header` | debug/debug-default-header.html | N/A | ❌ No equivalent | Debug utilities |
| `/debug/debug-default-footer` | debug/debug-default-footer.html | N/A | ❌ No equivalent | Debug utilities |
| `/debug/debug-localization` | debug/debug-localization.html | N/A | ❌ No equivalent | Debug utilities |
| `/debug/debug-plain` | debug/debug-plain.html | N/A | ❌ No equivalent | Debug utilities |
| `/debug/debug-webui` | debug/debug-webui.html | N/A | ❌ No equivalent | Debug utilities |

## Detailed Mappings by Category

### Authentication & Authorization

#### OAuth Flow
- **OBP-API**: `/oauth/authorize` → `oauth/authorize.html`
- **OBP-Portal**: `/login/[provider]` → Dynamic provider-based login
- **Notes**: Portal supports multiple OAuth providers with dynamic routing

#### Consent Management
- **OBP-API**: `/consent-screen` → `consent-screen.html`
- **OBP-Portal**: `/login/[provider]/callback` → Handles consent during OAuth callback
- **Notes**: Consent is now handled as part of the OAuth flow

#### User Consents List
- **OBP-API**: `/consents` → `consents.html`
- **OBP-Portal**: `/user/consents` → `(protected)/user/consents/+page.svelte`
- **Notes**: User-scoped, requires authentication

### User Management

#### User Profile
- **OBP-API**: `/user-information` → `user-information.html`
- **OBP-Portal**: `/user` → `(protected)/user/+page.svelte`
- **Notes**: Protected route with user profile information

#### User Invitation
- **OBP-API**: Multiple pages (`user-invitation.html`, `user-invitation-info.html`, `user-invitation-invalid.html`, `user-invitation-warning.html`)
- **OBP-Portal**: `/user-invitation` → `user-invitation/+page.svelte`
- **Notes**: Single page handles all invitation states with conditional rendering

#### User Validation
- **OBP-API**: N/A
- **OBP-Portal**: `/user-validation` → `user-validation/+page.svelte`
- **Notes**: New feature in Portal

### Consumer Management

#### Consumer Administration
- **OBP-API**: `/admin/consumers` → Admin-only consumer management
- **OBP-Portal**: `/user/consumers` → `(protected)/user/consumers/+page.svelte`
- **Notes**: Now user-scoped; each user manages their own consumers

#### Consumer Registration
- **OBP-API**: N/A (was part of admin interface)
- **OBP-Portal**: `/consumers/register` → `(protected)/consumers/register/+page.svelte`
- **Notes**: New self-service consumer registration

#### Consumer Registration Success
- **OBP-API**: N/A
- **OBP-Portal**: `/consumers/register/success` → `(protected)/consumers/register/success/+page.svelte`
- **Notes**: Success page shows new consumer keys (displayed only once)

### User Registration & Password Management

#### User Registration
- **OBP-API**: N/A (was handled via API or external tools)
- **OBP-Portal**: `/register` → `register/+page.svelte`
- **Notes**: New self-service user registration

#### Registration Success
- **OBP-API**: N/A
- **OBP-Portal**: `/register/success` → `register/success/+page.svelte`
- **Notes**: Confirmation page after successful registration

#### Forgot Password
- **OBP-API**: N/A
- **OBP-Portal**: `/forgot-password` → `forgot-password/+page.svelte`
- **Notes**: New password reset request flow

#### Reset Password
- **OBP-API**: N/A
- **OBP-Portal**: `/reset-password/[token]` → `reset-password/[token]/+page.svelte`
- **Notes**: Token-based password reset

### Information & Documentation

#### Home Page
- **OBP-API**: `/index` or `/index-en` → `index.html`, `index-en.html`
- **OBP-Portal**: `/` → `+page.svelte`
- **Notes**: Localization now handled via i18n library

#### About Page
- **OBP-API**: `/introduction` → `introduction.html`
- **OBP-Portal**: `/about` → `about/+page.svelte`
- **Notes**: General information about the platform

#### SDKs Page
- **OBP-API**: `/sdks` → `sdks.html`
- **OBP-Portal**: `/about` (partial)
- **Notes**: SDK information may be included in about page or separate documentation

#### Static Content
- **OBP-API**: `/static` → `static.html`
- **OBP-Portal**: N/A
- **Notes**: Static content handled differently in SvelteKit

### Policy & Legal

#### Terms and Conditions
- **OBP-API**: `/terms-and-conditions` → `terms-and-conditions.html`
- **OBP-Portal**: ❌ Not yet implemented
- **Recommendation**: Should be added to Portal

#### Privacy Policy
- **OBP-API**: `/privacy-policy` → `privacy-policy.html`
- **OBP-Portal**: ❌ Not yet implemented
- **Recommendation**: Should be added to Portal

### Development & Testing

#### Sandbox Account Creation
- **OBP-API**: `/create-sandbox-account` → `create-sandbox-account.html`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: Development feature for creating test accounts

#### Dummy User Tokens
- **OBP-API**: `/dummy-user-tokens` → `dummy-user-tokens.html`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: Development/testing feature

#### Debug Pages
- **OBP-API**: Multiple debug pages under `/debug/*`
- **OBP-Portal**: `/status` → `status/+page.svelte`
- **Notes**: Portal has a single status page instead of multiple debug pages

### Berlin Group Standard Support

#### Berlin Group Consent (various)
- **OBP-API**: `/confirm-bg-consent-request`, `/confirm-bg-consent-request-sca`, `/confirm-bg-consent-request-redirect-uri`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: Berlin Group PSD2 consent flows not yet implemented in Portal

### VRP (Variable Recurring Payments) Support

#### VRP Consent
- **OBP-API**: `/confirm-vrp-consent-request`, `/confirm-vrp-consent`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: VRP consent flows not yet implemented in Portal

### Authentication Context

#### User Auth Context Updates
- **OBP-API**: `/add-user-auth-context-update-request`, `/confirm-user-auth-context-update-request`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: Advanced authentication context management not yet implemented

### OTP (One-Time Password)

#### OTP Validation
- **OBP-API**: `/otp` → `otp.html`
- **OBP-Portal**: ❌ Not yet implemented
- **Notes**: OTP validation page for payment authorization

### System Status

#### Health Check / Status
- **OBP-API**: `/debug/awake` → `debug/awake.html`
- **OBP-Portal**: `/status` → `status/+page.svelte`
- **Notes**: Shows system status and connectivity

## New Pages in OBP-Portal (Not in OBP-API)

| OBP-Portal Path | Purpose | Notes |
|----------------|---------|-------|
| `/about` | About page | Information about the platform |
| `/login` | Login page | Unified login interface |
| `/login/obp` | OBP-specific login | Direct OBP authentication |
| `/login/obp/callback` | OBP OAuth callback | Handles OBP OAuth flow |
| `/logout` | Logout endpoint | Session termination |
| `/register` | User registration | Self-service registration |
| `/register/success` | Registration success | Confirmation page |
| `/forgot-password` | Password reset request | Initiate password reset |
| `/reset-password/[token]` | Password reset | Token-based reset |
| `/user-validation` | User validation | Email/account validation |
| `/user/entitlements` | User entitlements | Permission management |
| `/consumers/register` | Consumer registration | Self-service API key creation |
| `/consumers/register/success` | Consumer registration success | Shows newly created keys |
| `/status` | System status | Health and connectivity info |

## Migration Strategy

### Phase 1: Core User Features (✅ Complete)
- ✅ User authentication and login
- ✅ User profile management
- ✅ User registration
- ✅ Password reset
- ✅ Consumer management (self-service)
- ✅ Consent management
- ✅ User invitations

### Phase 2: Information & Documentation (⚠️ Partial)
- ✅ About page
- ⚠️ SDKs documentation (needs enhancement)
- ❌ Terms and Conditions (needs implementation)
- ❌ Privacy Policy (needs implementation)

### Phase 3: Advanced Features (❌ Not Started)
- ❌ Berlin Group consent flows
- ❌ VRP consent management
- ❌ OTP validation
- ❌ Auth context updates
- ❌ Sandbox account creation

### Phase 4: Development Tools (⚠️ Minimal)
- ✅ Basic status page
- ❌ Debug utilities
- ❌ Dummy token generation

## Nginx Redirect Strategy

For pages with equivalents, nginx should use 301 (permanent) redirects:
```nginx
location = /old-path {
    return 301 $scheme://$OBP_PORTAL_HOST/new-path;
}
```

For pages without equivalents:
- Option 1: Redirect to Portal root with notice parameter
- Option 2: Show "feature not yet implemented" message
- Option 3: Keep serving from OBP-API until Portal implementation

## Summary Statistics

- **Total OBP-API Pages**: 41
- **Direct Equivalents (✅)**: 11 pages (27%)
- **Partial Equivalents (⚠️)**: 3 pages (7%)
- **No Equivalent (❌)**: 27 pages (66%)
- **New in Portal (🆕)**: 12 pages

## Recommendations

1. **High Priority**: Implement Terms and Privacy Policy pages
2. **Medium Priority**: Add sandbox account creation for developers
3. **Low Priority**: Consider if Berlin Group/VRP features are needed
4. **Consider**: Whether debug utilities are needed or if status page is sufficient
5. **Evaluate**: If OTP validation page is required for the Portal's use cases