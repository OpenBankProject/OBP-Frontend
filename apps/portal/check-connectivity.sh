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

# OBP Portal Connectivity Check Script
# This script tests network connectivity for OAuth/OIDC components

set -e

echo "🔍 OBP Portal Connectivity Check"
echo "================================="
echo ""

# Load environment variables if .env exists
if [ -f ".env" ]; then
    echo "📋 Loading environment variables from .env"
    source .env
else
    echo "⚠️  No .env file found, using defaults"
fi

# Set defaults
OBP_BASE_URL=${PUBLIC_OBP_BASE_URL:-"http://localhost:8080"}
OIDC_WELL_KNOWN_URL=${OBP_OAUTH_WELL_KNOWN_URL:-"http://127.0.0.1:9000/obp-oidc/.well-known/openid-configuration"}
OIDC_ISSUER=${VITE_OIDC_ISSUER:-"http://127.0.0.1:9000"}

echo "🔧 Configuration:"
echo "   OBP Base URL: $OBP_BASE_URL"
echo "   OIDC Well-known URL: $OIDC_WELL_KNOWN_URL"
echo "   OIDC Issuer: $OIDC_ISSUER"
echo ""

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local name=$2

    echo "🌐 Testing $name: $url"

    if curl -s --connect-timeout 10 --max-time 30 "$url" > /dev/null 2>&1; then
        echo "   ✅ Reachable"

        # Get response details
        response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        content_type=$(curl -s -I "$url" | grep -i "content-type:" | head -1 | cut -d' ' -f2- | tr -d '\r\n')

        echo "   📊 Status: $response_code"
        echo "   📄 Content-Type: $content_type"

        if [ "$response_code" = "200" ]; then
            return 0
        else
            echo "   ⚠️  Non-200 status code"
            return 1
        fi
    else
        echo "   ❌ Not reachable"
        return 1
    fi
}

# Function to test JSON endpoint and extract data
test_json_endpoint() {
    local url=$1
    local name=$2

    echo "📋 Testing $name JSON: $url"

    if response=$(curl -s --connect-timeout 10 --max-time 30 "$url" 2>/dev/null); then
        if echo "$response" | jq . > /dev/null 2>&1; then
            echo "   ✅ Valid JSON response"

            # Extract key fields if it's OIDC config
            if echo "$response" | jq -e '.issuer' > /dev/null 2>&1; then
                issuer=$(echo "$response" | jq -r '.issuer')
                auth_endpoint=$(echo "$response" | jq -r '.authorization_endpoint // "not found"')
                token_endpoint=$(echo "$response" | jq -r '.token_endpoint // "not found"')
                jwks_uri=$(echo "$response" | jq -r '.jwks_uri // "not found"')

                echo "   🏷️  Issuer: $issuer"
                echo "   🔐 Auth Endpoint: $auth_endpoint"
                echo "   🎫 Token Endpoint: $token_endpoint"
                echo "   🔑 JWKS URI: $jwks_uri"

                # Return JWKS URI for further testing
                echo "$jwks_uri"
                return 0
            else
                echo "   📄 JSON response (not OIDC config)"
                return 0
            fi
        else
            echo "   ❌ Invalid JSON response"
            echo "   Response preview: $(echo "$response" | head -c 200)..."
            return 1
        fi
    else
        echo "   ❌ Failed to fetch"
        return 1
    fi
}

echo "🚀 Starting connectivity tests..."
echo ""

# Test 1: OBP API Root
echo "1️⃣  Testing OBP API"
echo "-------------------"
test_endpoint "$OBP_BASE_URL/obp/v5.1.0/root" "OBP API Root"
echo ""

# Test 2: OBP Well-known endpoint
echo "2️⃣  Testing OBP Well-known OAuth providers"
echo "------------------------------------------"
test_endpoint "$OBP_BASE_URL/obp/v5.1.0/well-known" "OBP Well-known"
echo ""

# Test 3: OIDC Well-known configuration
echo "3️⃣  Testing OIDC Configuration"
echo "------------------------------"
jwks_uri=$(test_json_endpoint "$OIDC_WELL_KNOWN_URL" "OIDC Well-known")
echo ""

# Test 4: JWKS endpoint if available
if [ ! -z "$jwks_uri" ] && [ "$jwks_uri" != "not found" ] && [ "$jwks_uri" != "null" ]; then
    echo "4️⃣  Testing JWKS Endpoint"
    echo "------------------------"
    test_json_endpoint "$jwks_uri" "JWKS"
    echo ""
else
    echo "4️⃣  Skipping JWKS test (URI not found)"
    echo ""
fi

# Test 5: Network resolution for hostnames
echo "5️⃣  Testing DNS Resolution"
echo "-------------------------"
for url in "$OBP_BASE_URL" "$OIDC_WELL_KNOWN_URL" "$OIDC_ISSUER"; do
    # Extract hostname from URL
    hostname=$(echo "$url" | sed -E 's|^https?://([^/]+).*|\1|' | cut -d':' -f1)
    if [ "$hostname" != "localhost" ] && [ "$hostname" != "127.0.0.1" ]; then
        echo "🌐 Resolving: $hostname"
        if nslookup "$hostname" > /dev/null 2>&1; then
            echo "   ✅ DNS resolution successful"
            ip=$(nslookup "$hostname" | grep -A1 "Name:" | tail -1 | awk '{print $2}' 2>/dev/null || echo "unknown")
            echo "   🏠 IP: $ip"
        else
            echo "   ❌ DNS resolution failed"
        fi
    else
        echo "🏠 Local hostname: $hostname (skipping DNS check)"
    fi
done
echo ""

# Test 6: Port connectivity
echo "6️⃣  Testing Port Connectivity"
echo "-----------------------------"
for url in "$OBP_BASE_URL" "$OIDC_ISSUER"; do
    hostname=$(echo "$url" | sed -E 's|^https?://([^/]+).*|\1|' | cut -d':' -f1)
    port=$(echo "$url" | sed -E 's|^https?://[^:]+:?([0-9]*)/.*|\1|')

    # Default ports
    if [ -z "$port" ]; then
        if echo "$url" | grep -q "^https://"; then
            port=443
        else
            port=80
        fi
    fi

    echo "🔌 Testing $hostname:$port"
    if timeout 10 bash -c "</dev/tcp/$hostname/$port" 2>/dev/null; then
        echo "   ✅ Port is open"
    else
        echo "   ❌ Port is not accessible"
    fi
done
echo ""

# Summary and recommendations
echo "📊 Summary & Recommendations"
echo "============================"
echo ""
echo "If you're seeing OBP-20208 errors, check:"
echo ""
echo "1. 🔍 Network Connectivity:"
echo "   - All endpoints should be reachable from OBP API server"
echo "   - JWKS URI must be accessible from OBP API server"
echo "   - Check firewall rules between components"
echo ""
echo "2. 🏷️  Issuer Configuration:"
echo "   - JWT tokens must have issuer matching OBP configuration"
echo "   - OIDC issuer should match what OBP expects"
echo "   - Check if using container names vs localhost"
echo ""
echo "3. 🐳 Container/Docker Issues:"
echo "   - Use container names instead of localhost in Docker"
echo "   - Ensure all services are on same Docker network"
echo "   - Check port mappings and service discovery"
echo ""
echo "4. 🔧 Environment Variables:"
echo "   - Verify all OAuth/OIDC URLs are correct"
echo "   - Check if URLs are accessible from all components"
echo "   - Ensure consistent protocol (http/https)"
echo ""
echo "✅ Connectivity check complete!"
echo ""
echo "🔧 Next steps:"
echo "   - Run: node debug-oauth.js [access_token] for JWT analysis"
echo "   - Check OBP API server logs for detailed error information"
echo "   - Verify OBP API OAuth configuration matches OIDC provider"
