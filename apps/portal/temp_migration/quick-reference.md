# Quick Reference: OBP-API to OBP-Portal URL Mappings

## Most Common Redirects

| Old URL (OBP-API) | New URL (OBP-Portal) | Status |
|-------------------|----------------------|--------|
| `/index` | `/` | ✅ |
| `/index-en` | `/` | ✅ |
| `/user-information` | `/user` | ✅ |
| `/consents` | `/user/consents` | ✅ |
| `/oauth/authorize` | `/login` | ✅ |
| `/admin/consumers` | `/user/consumers` | ✅ |
| `/user-invitation` | `/user-invitation` | ✅ |
| `/introduction` | `/about` | ⚠️ |
| `/sdks` | `/about` | ⚠️ |
| `/debug/awake` | `/status` | ⚠️ |

## Pages Without Portal Equivalents (Yet)

| Old URL | Suggested Redirect | Priority |
|---------|-------------------|----------|
| `/terms-and-conditions` | `/` | High |
| `/privacy-policy` | `/` | High |
| `/create-sandbox-account` | `/register` | Medium |
| `/otp` | `/login` | Medium |
| `/dummy-user-tokens` | `/user/consumers` | Low |
| `/confirm-bg-consent-request` | `/` | Low |
| `/confirm-vrp-consent` | `/` | Low |
| `/debug/*` | `/status` | Low |

## New Features in Portal (Not in OBP-API)

| New URL | Description |
|---------|-------------|
| `/about` | About page |
| `/register` | User self-registration |
| `/register/success` | Registration confirmation |
| `/forgot-password` | Password reset request |
| `/reset-password/[token]` | Password reset form |
| `/user/entitlements` | User permissions management |
| `/consumers/register` | Self-service API key creation |
| `/consumers/register/success` | New API key display |
| `/user-validation` | Email validation |
| `/status` | System status |

## Nginx Quick Setup

```nginx
# Set your portal hostname
set $OBP_PORTAL_HOST portal.example.com;

# Most important redirects
location = /index { return 301 $scheme://$OBP_PORTAL_HOST/; }
location = /user-information { return 301 $scheme://$OBP_PORTAL_HOST/user; }
location = /consents { return 301 $scheme://$OBP_PORTAL_HOST/user/consents; }
location = /oauth/authorize { return 301 $scheme://$OBP_PORTAL_HOST/login; }
location = /admin/consumers { return 301 $scheme://$OBP_PORTAL_HOST/user/consumers; }

# Keep API endpoints proxied (DO NOT REDIRECT)
location ~ ^/obp/ {
    proxy_pass http://obp_api_backend;
}
```

## Status Legend

- ✅ **Direct equivalent exists** - Full feature parity
- ⚠️ **Partial equivalent** - Similar functionality with differences
- ❌ **No equivalent** - Not yet implemented in Portal

## Migration Checklist

- [ ] Deploy OBP-Portal on new domain
- [ ] Test Portal functionality
- [ ] Configure nginx with redirects
- [ ] Test redirects (UI pages should redirect)
- [ ] Test API passthrough (API calls should NOT redirect)
- [ ] Update documentation with new URLs
- [ ] Communicate changes to users
- [ ] Monitor logs for issues

## Common Issues

**Problem**: API calls return redirect HTML instead of JSON  
**Fix**: Ensure `/obp/` paths are proxied, not redirected

**Problem**: Portal shows 404 for redirected page  
**Fix**: Check page-mappings.md - page may not be implemented yet

**Problem**: OAuth flow breaks  
**Fix**: Keep `/oauth/token` endpoint proxied to API backend

**Problem**: Too many redirects  
**Fix**: Verify Portal doesn't redirect back to API domain

## Testing Commands

```bash
# Test UI redirect
curl -I https://api.example.com/user-information
# Expected: 301 redirect to portal

# Test API passthrough
curl -H "Authorization: DirectLogin token=xxx" \
     https://api.example.com/obp/v5.1.0/banks
# Expected: JSON API response (not redirect)

# Check nginx config
sudo nginx -t
```

## Statistics

- **OBP-API Pages**: 41 total
- **Direct Equivalents**: 11 (27%)
- **Partial Equivalents**: 3 (7%)
- **No Equivalents**: 27 (66%)
- **New in Portal**: 12 pages

## Next Steps

1. Review full mappings in `page-mappings.md`
2. Configure nginx using `nginx-redirect-config.conf`
3. See complete example in `nginx-server-example.conf`
4. Read deployment guide in `README.md`
