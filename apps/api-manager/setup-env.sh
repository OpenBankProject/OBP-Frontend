#!/bin/bash
# Copyright (C) 2025-2026 TESOBE GmbH
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

# Setup script for API Manager II environment configuration
# This script will create/update the .env file with the provided OBP OAuth credentials

echo "Setting up API Manager II environment configuration..."

# Create .env file with the OBP OAuth credentials
cat > .env << EOF
# OBP API Configuration
PUBLIC_OBP_BASE_URL=http://127.0.0.1:8080

# OAuth Client Configuration (OBP OIDC)
OBP_OAUTH_CLIENT_ID=39fb9d38-cd0e-44e7-9da5-556d0673e40d
OBP_OAUTH_CLIENT_SECRET=NJsso0ugXG6sTT3ngDolw6U_Gr3hfdqCHG-0hvaT54I

# Application Configuration
APP_CALLBACK_URL=http://localhost:3003/login/obp/callback

# Redis Configuration (for session storage)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password_if_needed

# Additional OBP Client Information (for reference)
# CLIENT_NAME=obp-api-manager-ii
# CONSUMER_ID=7707cbdb-985f-458a-8b87-e9416c44c421

# Server Configuration
PORT=3003
EOF

echo "✅ .env file created successfully!"
echo ""
echo "Configuration Summary:"
echo "  - OBP API Base URL: http://127.0.0.1:8080"
echo "  - OBP OIDC Server: http://127.0.0.1:9000"
echo "  - OAuth Client ID: 39fb9d38-cd0e-44e7-9da5-556d0673e40d"
echo "  - Callback URL: http://localhost:3003/login/obp/callback"
echo "  - Server Port: 3003"
echo ""
echo "Available OAuth Endpoints (OIDC Server on port 9000):"
echo "  - Discovery: http://127.0.0.1:9000/obp-oidc/.well-known/openid-configuration"
echo "  - Authorization: http://127.0.0.1:9000/obp-oidc/auth"
echo "  - Token: http://127.0.0.1:9000/obp-oidc/token"
echo "  - UserInfo: http://127.0.0.1:9000/obp-oidc/userinfo"
echo "  - JWKS: http://127.0.0.1:9000/obp-oidc/jwks"
echo ""
echo "Available OBP API Endpoints (API Server on port 8080):"
echo "  - Current User: http://127.0.0.1:8080/obp/v5.1.0/users/current"
echo "  - Banks: http://127.0.0.1:8080/obp/v5.1.0/banks"
echo ""
echo "Next Steps:"
echo "1. Make sure Redis is running on localhost:6379"
echo "2. Make sure your OBP OIDC server is running on http://127.0.0.1:9000"
echo "3. Make sure your OBP API server is running on http://127.0.0.1:8080"
echo "4. Run: npm run dev"
echo "5. Visit: http://localhost:3003/login"
echo ""
echo "Note: The callback URL is configured for http://localhost:3003/login/obp/callback"
echo "Make sure this matches your OBP client configuration."
