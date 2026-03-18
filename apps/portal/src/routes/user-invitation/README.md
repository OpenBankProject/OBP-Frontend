# User Invitation Route

## Overview

This route handles the complete user invitation acceptance flow. When a user receives an invitation email and clicks the link, they land here to complete their entire account setup, including password creation, entirely within the Portal without ever leaving to external pages.

## URL Structure

```
/user-invitation?id={SECRET_KEY}
```

**Query Parameters:**
- `id` (required) - The secret key from the invitation email (numeric)

## Files

- `+page.server.ts` - Server-side logic for validation and form handling
- `+page.svelte` - User interface with auto-validation and signup form
- `README.md` - This file

## How It Works

### 1. Page Load
- Extracts `secret_key` from URL query parameter
- Returns secret key and API base URL to the page

### 2. Auto-Validation
- Page automatically validates invitation on mount
- Calls `?/validate` action with secret key
- Shows loading spinner during validation

### 3. Validation Success
- Displays invitation details (name, email, company, etc.)
- Pre-populates username field with suggestion
- Shows password and confirm password fields
- Shows terms and conditions checkboxes
- Enables account creation form

### 4. User Input
- User enters/confirms username
- User creates password (minimum 8 characters)
- User confirms password (must match)
- User accepts required terms (privacy, T&Cs, data consent)
- User optionally accepts marketing communications
- Form validates all required fields before enabling submit

### 5. Account Creation (Option B - Full Portal Flow)
- Form submits to `?/accept` action
- Server validates all required fields (username, password, password match, terms)
- Server calls PUT /obp/v4.0.0/banks/{BANK_ID}/user-invitation with full user data
- Account is created directly via REST API
- Redirects to login page with success message
- User can immediately log in with their new credentials

## Server Actions

### `validate`
**Purpose:** Validates the invitation secret key

**Input:**
- `secret_key` - The invitation secret key
- `bank_id` - (optional) Bank ID to validate against

**API Call:**
```
POST /obp/v4.0.0/banks/{BANK_ID}/user-invitations
Body: { "secret_key": 5819479115482092878 }
```

**Returns:**
- Success: `{ success: true, invitation: {...} }`
- Error: `{ success: false, error: "message" }`

### `accept`
**Purpose:** Creates user account directly in Portal via REST API

**Input:**
- `secret_key` - The invitation secret key
- `username` - User's chosen username
- `password` - User's password (minimum 8 characters)
- `confirm_password` - Password confirmation (must match)
- `first_name` - From invitation (hidden field)
- `last_name` - From invitation (hidden field)
- `email` - From invitation (hidden field)
- `company` - From invitation (hidden field)
- `country` - From invitation (hidden field)
- `privacy_policy` - Must be "on"
- `terms_conditions` - Must be "on"
- `personal_data` - Must be "on"
- `marketing` - Optional

**API Call:**
```
PUT /obp/v4.0.0/banks/{BANK_ID}/user-invitation
Body: { secret_key, username, password, first_name, last_name, email, company, country }
```

**Returns:**
- Success: Redirects to `/login?invitation_accepted=true`
- Error: Returns error message to display on form

## UI States

### Loading
```
[Spinner]
Validating your invitation...
```

### Error
```
[X] Invitation Invalid
{error message}
If you believe this is an error, please contact your administrator...
```

### Success
```
[✓] Invitation Validated
Your invitation has been verified...

[Invitation Details]
- Name, Email, Company, Country, Account Type

[Account Setup Form]
- Username (editable)
- Password (show/hide toggle, minimum 8 chars)
- Confirm Password (match validation)
- Privacy Policy ☐
- Terms and Conditions ☐
- Personal Data Collection ☐
- Marketing (Optional) ☐

[Create Account]
```

## Configuration

### Environment Variables

**Required:**
```bash
PUBLIC_OBP_BASE_URL=https://api.example.com
```

**Optional:**
```bash
DEFAULT_BANK_ID=gh.29.uk
# or
PUBLIC_DEFAULT_BANK_ID=gh.29.uk
```

## Error Handling

### Client-Side
- Missing `id` parameter → 400 error page
- Invalid form data → Disabled submit button
- Password too short → Disabled submit button
- Passwords don't match → Disabled submit button
- Missing required checkboxes → Disabled submit button

### Server-Side
- Invalid secret key → Error message
- Password validation errors → User-friendly error messages
- Username/email already exists → User-friendly error messages
- API errors → User-friendly error messages
- Network errors → Logged and shown to user

### API Error Codes
- `OBP-37883` - Invitation invalid/expired/used
- `OBP-20001` - Username already exists
- `OBP-20002` - Email already registered
- `OBP-10202` - Password doesn't meet security requirements
- `400` - Bad request
- `404` - Not found

## TypeScript Types

```typescript
// From src/lib/obp/types.ts

interface OBPUserInvitation {
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    country: string;
    purpose: 'DEVELOPER' | 'CUSTOMER';
    status: 'CREATED' | 'FINISHED';
}

interface OBPUserInvitationValidateRequestBody {
    secret_key: number;
}
```

## Testing

### Manual Test
1. Get invitation email with link
2. Click link → Should land on this page
3. Verify auto-validation runs
4. Check that form populates with user data
5. Enter username
6. Create password (minimum 8 characters)
7. Confirm password (must match)
8. Accept required terms
9. Submit form
10. Verify account is created and redirected to login
11. Verify success message displays on login page
12. Test login with new credentials

### Test Cases
- Valid invitation → Shows form ✓
- Invalid secret key → Shows error ✓
- Expired invitation → Shows error ✓
- Used invitation → Shows error ✓
- Missing `id` parameter → 400 error ✓
- Empty username → Submit disabled ✓
- Password too short → Submit disabled ✓
- Passwords don't match → Submit disabled ✓
- Unchecked terms → Submit disabled ✓
- Username already exists → Error message ✓

## Security

- Public endpoint (no authentication required)
- Security via unguessable secret key (cryptographically random)
- Single-use invitations (status tracked in DB)
- Time-limited (24 hours default)
- Password minimum length enforced (8 characters)
- Password confirmation required
- Secure password transmission over HTTPS
- HTTPS required in production

## Implementation Approach

**✅ Implemented: Option B (Full Portal Flow)**
- Portal validates invitation
- Portal collects all user data including password
- Portal creates account via REST API (PUT endpoint)
- User stays in Portal throughout entire process
- Redirects to login with success message
- Superior user experience

**Not Used: Option A (Redirect to OBP-API)**
- Would redirect user to external OBP-API pages
- User would leave Portal temporarily
- Less seamless experience

## Related Documentation

- [User Invitation Acceptance](../../docs/USER_INVITATION_ACCEPTANCE.md) - Full documentation
- [Quick Reference](../../docs/USER_INVITATION_ACCEPTANCE_QUICK_REFERENCE.md) - Quick reference guide
- [Password Reset](../reset-password/[token]/+page.server.ts) - Related flow

## Support

For issues:
1. Check `PUBLIC_OBP_BASE_URL` environment variable
2. Verify OBP-API is accessible
3. Check OBP-API logs for errors
4. Ensure invitation isn't expired or used
5. Verify bank_id configuration if custom

## Future Enhancements

- [x] ~~Keep user in Portal for entire flow~~ ✅ COMPLETE (Option B)
- [ ] Auto-detect bank_id from invitation
- [ ] Add password strength meter
- [ ] Add password requirements tooltip
- [ ] Add email verification step
- [ ] Show privacy policy/terms in modal
- [ ] Add bank-specific branding
- [ ] Support custom styling per bank