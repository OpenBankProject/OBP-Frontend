# OBP-API to OBP-Portal Migration Guide

This directory contains configuration files and documentation for migrating from OBP-API (Lift Web) to OBP-Portal (SvelteKit).

## Contents

- **`nginx-redirect-config.conf`** - Nginx redirect rules for mapping OBP-API paths to OBP-Portal
- **`nginx-server-example.conf`** - Complete nginx server configuration example
- **`page-mappings.md`** - Comprehensive mapping of all pages between OBP-API and OBP-Portal
- **`README.md`** - This file

## Overview

The OBP-Portal is a modern SvelteKit-based web application that replaces the legacy Lift Web-based UI in OBP-API. This migration guide helps you:

1. Redirect users from old OBP-API URLs to new OBP-Portal URLs
2. Understand which pages have equivalents in the new Portal
3. Configure nginx to handle both API and Portal traffic

## Quick Start

### Option 1: Include Redirect Rules in Existing Config

If you already have an nginx configuration for OBP-API:

```bash
# 1. Copy the redirect config to your nginx directory
sudo cp nginx-redirect-config.conf /etc/nginx/conf.d/

# 2. Edit your existing server block to include:
# - Set the $OBP_PORTAL_HOST variable
# - Include the redirect config file

# Example addition to your server block:
set $OBP_PORTAL_HOST portal.example.com;
include /etc/nginx/conf.d/nginx-redirect-config.conf;

# 3. Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Use Complete Server Configuration

If you're setting up nginx from scratch:

```bash
# 1. Copy the example server config
sudo cp nginx-server-example.conf /etc/nginx/sites-available/obp

# 2. Edit the file and update:
#    - server_name
#    - $OBP_PORTAL_HOST
#    - SSL certificate paths
#    - upstream server addresses

# 3. Enable the site
sudo ln -s /etc/nginx/sites-available/obp /etc/nginx/sites-enabled/

# 4. Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Configuration Variables

You must set these variables in your nginx configuration:

- **`$OBP_PORTAL_HOST`** - The hostname of your OBP-Portal instance
  - Example: `portal.example.com`
  - Used in all redirect rules

## URL Mapping Examples

Here are some key mappings:

| Old OBP-API URL | New OBP-Portal URL | Redirect Type |
|----------------|-------------------|---------------|
| `/index` | `/` | 301 Permanent |
| `/user-information` | `/user` | 301 Permanent |
| `/consents` | `/user/consents` | 301 Permanent |
| `/oauth/authorize` | `/login` | 301 Permanent |
| `/admin/consumers` | `/user/consumers` | 301 Permanent |
| `/user-invitation` | `/user-invitation` | 301 Permanent |

For a complete list, see `page-mappings.md`.

## Redirect Types

The configuration uses different redirect types:

- **301 Permanent Redirect** - For pages with direct equivalents
  - Browsers will cache these redirects
  - Search engines will update their indexes
  
- **302 Temporary Redirect** - For pages without equivalents (yet)
  - Used for features still in development
  - Browsers won't cache these redirects

## Architecture

```
┌─────────────────┐
│  User Browser   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│   Nginx Reverse Proxy           │
│                                 │
│  ┌──────────────────────────┐  │
│  │  URL Pattern Matching    │  │
│  └──────────┬───────────────┘  │
│             │                   │
│    ┌────────┴────────┐         │
│    │                 │         │
│    ▼                 ▼         │
│  Web UI          API Calls     │
│  Redirect      Proxy Through   │
│    │                 │         │
└────┼─────────────────┼─────────┘
     │                 │
     ▼                 ▼
┌────────────┐   ┌────────────┐
│ OBP-Portal │   │  OBP-API   │
│ (SvelteKit)│   │  (Scala)   │
└────────────┘   └────────────┘
```

## Important Notes

### API Endpoints Are NOT Redirected

Only web UI pages are redirected. API endpoints (paths starting with `/obp/`) are proxied to the OBP-API backend:

```nginx
# API calls go to OBP-API
location ~ ^/obp/ {
    proxy_pass http://obp_api;
}

# UI pages redirect to Portal
location = /user-information {
    return 301 $scheme://$OBP_PORTAL_HOST/user;
}
```

### OAuth Token Endpoints

The OAuth **token** endpoint (`/oauth/token`) must remain with OBP-API, while the **authorize** endpoint redirects to Portal:

```nginx
location ~ ^/oauth/ {
    # Token endpoint stays with API
    if ($request_uri ~* "^/oauth/token") {
        proxy_pass http://obp_api;
        break;
    }
    
    # Authorize redirects to Portal
    return 301 $scheme://$OBP_PORTAL_HOST/login;
}
```

### Content Negotiation

The example configuration includes smart routing based on request characteristics:

- Requests with `Authorization` header → proxy to API
- Requests accepting `application/json` → proxy to API
- Other requests → redirect to Portal

## Pages Without Equivalents

Some OBP-API pages don't have Portal equivalents yet. The configuration handles these in different ways:

### 1. Redirect to Portal Root
For informational pages:
```nginx
location = /terms-and-conditions {
    return 301 $scheme://$OBP_PORTAL_HOST/;
}
```

### 2. Redirect with Notice Parameter
For specialized features:
```nginx
location ~ ^/confirm-bg-consent-request {
    return 302 $scheme://$OBP_PORTAL_HOST/?notice=berlin_group_consent;
}
```

### 3. Redirect to Similar Page
For related functionality:
```nginx
location = /dummy-user-tokens {
    return 301 $scheme://$OBP_PORTAL_HOST/user/consumers;
}
```

## Testing the Configuration

### 1. Syntax Check
```bash
sudo nginx -t
```

### 2. Test Redirects
```bash
# Test a redirect
curl -I http://api.example.com/user-information

# Should return:
# HTTP/1.1 301 Moved Permanently
# Location: https://portal.example.com/user
```

### 3. Test API Passthrough
```bash
# Test that API calls still work
curl -H "Authorization: DirectLogin token=xxx" \
     http://api.example.com/obp/v5.1.0/banks

# Should return API response, not a redirect
```

### 4. Monitor Logs
```bash
# Watch access logs for redirects
sudo tail -f /var/log/nginx/obp-api-access.log

# Watch for errors
sudo tail -f /var/log/nginx/obp-api-error.log
```

## Migration Phases

### Phase 1: Soft Launch (Recommended)
1. Deploy OBP-Portal to a new domain (e.g., `portal.example.com`)
2. Keep OBP-API UI running on existing domain
3. Add informational banners pointing users to new Portal
4. Monitor Portal usage and stability

### Phase 2: Redirect Implementation
1. Implement nginx redirects as shown in this guide
2. Old URLs automatically redirect to new Portal
3. API functionality remains unchanged
4. Monitor redirect patterns and user feedback

### Phase 3: Full Migration
1. Update all documentation with new URLs
2. Update bookmarks and saved links
3. Communicate changes to users
4. Eventually deprecate old UI endpoints

## Security Considerations

### HTTPS Enforcement
Always redirect HTTP to HTTPS in production:
```nginx
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

### Headers
The example configuration includes security headers:
- `X-Frame-Options`
- `X-Content-Type-Options`
- `X-XSS-Protection`
- `Referrer-Policy`
- `Content-Security-Policy` (for Portal)

### SSL/TLS Configuration
Use modern TLS versions and secure ciphers:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

## Monitoring and Analytics

Consider tracking redirects for migration insights:

1. **Log Analysis**: Review nginx logs for redirect patterns
2. **Analytics**: Track which old URLs are still being used
3. **User Feedback**: Monitor support tickets about broken links
4. **API Usage**: Ensure API calls aren't accidentally redirected

## Troubleshooting

### Redirect Loops
**Problem**: Browser shows "too many redirects"
**Solution**: Check that Portal doesn't redirect back to API

### API Calls Redirected
**Problem**: API responses return HTML redirect pages
**Solution**: Ensure `/obp/` paths are proxied, not redirected

### SSL Certificate Errors
**Problem**: Users see certificate warnings
**Solution**: Update SSL certificates for both API and Portal domains

### 404 Errors on Portal
**Problem**: Redirected pages show 404 in Portal
**Solution**: Verify the Portal route exists (check `page-mappings.md`)

## Support

For detailed page mappings, see `page-mappings.md`.

For questions or issues:
1. Check the [OBP-Portal Documentation](../docs/)
2. Review the [page-mappings.md](./page-mappings.md) file
3. Open an issue on the OBP-Portal GitHub repository

## License

This configuration is provided as part of the OBP-Portal project.
See the main LICENSE file in the repository root.

## Changelog

- **2025-01-XX**: Initial migration configuration created
  - Added nginx redirect rules
  - Documented page mappings
  - Created example configurations