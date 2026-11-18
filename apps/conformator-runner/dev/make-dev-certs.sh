#!/bin/bash
# Copyright (C) 2026 TESOBE GmbH
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
#
# Make certificates for trying the runner against dev/fake-bank.mjs, on a laptop only:
#   - dev/certs/: a test CA, and the fake bank's server certificate for localhost;
#   - credentials/<SYSTEM_ID>/: the runner's client certificate, the CA, and secrets.json with the test customer token.
#
# Usage: dev/make-dev-certs.sh <SYSTEM_ID>
# SYSTEM_ID is the id of the system you added in the web app (shown on the system's page).

set -euo pipefail

if [ $# -ne 1 ] || ! [[ "$1" =~ ^[A-Za-z0-9_-]+$ ]]; then
	echo "Usage: $0 <SYSTEM_ID>   (letters, digits, - and _ only)" >&2
	exit 1
fi

cd "$(dirname "$0")/.."
SYSTEM_ID="$1"
CERTS=dev/certs
CREDS="credentials/$SYSTEM_ID"
mkdir -p "$CERTS" "$CREDS"

if [ ! -f "$CERTS/ca.crt" ]; then
	openssl req -x509 -newkey rsa:2048 -nodes -keyout "$CERTS/ca.key" -out "$CERTS/ca.crt" -days 365 -subj "/CN=Conformator dev CA" 2>/dev/null
	printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\n' > "$CERTS/san.cnf"
	openssl req -newkey rsa:2048 -nodes -keyout "$CERTS/server.key" -out "$CERTS/server.csr" -subj "/CN=localhost" 2>/dev/null
	openssl x509 -req -in "$CERTS/server.csr" -CA "$CERTS/ca.crt" -CAkey "$CERTS/ca.key" -CAcreateserial -out "$CERTS/server.crt" -days 365 -extfile "$CERTS/san.cnf" 2>/dev/null
	echo "Made the dev CA and the fake bank's certificate in $CERTS"
fi

openssl req -newkey rsa:2048 -nodes -keyout "$CREDS/client.key" -out "$CREDS/client.csr" -subj "/CN=conformator-runner" 2>/dev/null
openssl x509 -req -in "$CREDS/client.csr" -CA "$CERTS/ca.crt" -CAkey "$CERTS/ca.key" -CAcreateserial -out "$CREDS/client.crt" -days 365 2>/dev/null
rm -f "$CREDS/client.csr"
cp "$CERTS/ca.crt" "$CREDS/ca.crt"
printf '{\n  "customer_access_token": "demo-customer-token"\n}\n' > "$CREDS/secrets.json"
chmod 600 "$CREDS/client.key" "$CREDS/secrets.json"

echo "Made the runner's credentials for system $SYSTEM_ID in $CREDS"
echo "In the web app, give the system: base URL https://localhost:8443/open-banking/v1,"
echo "discovery URL https://localhost:8443/.well-known/openid-configuration, and client id conformator-runner."
