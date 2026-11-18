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
# Run the OpenID Foundation's conformance suite locally, for the runner's openid:plan checks. It is the suite's own
# development setup (its docker-compose.yml): MongoDB, the Java server and nginx on https://localhost.emobix.co.uk:8443
# (a public name for 127.0.0.1). The suite is MIT licensed and is used over HTTP only.
#
# Needs git, a JDK 17 or later with Maven, and Docker with compose. The first build takes several minutes.
#
# Usage: dev/openid-suite/start-openid-suite.sh        # build if needed, then start
#        dev/openid-suite/start-openid-suite.sh stop   # stop it

set -euo pipefail

VERSION="${OPENID_SUITE_VERSION:-release-v5.3.4}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/conformance-suite"

if [ "${1:-}" = "stop" ]; then
	(cd "$SRC" && docker compose down)
	exit 0
fi

if [ ! -d "$SRC" ]; then
	git clone --depth 1 --branch "$VERSION" https://gitlab.com/openid/conformance-suite.git "$SRC"
fi

if [ ! -f "$SRC/target/fapi-test-suite.jar" ]; then
	echo "Building the suite ($VERSION) with Maven..."
	(cd "$SRC" && mvn -B -q package -DskipTests)
fi

(cd "$SRC" && docker compose up -d --build)

echo "Waiting for the suite to answer..."
for _ in $(seq 1 60); do
	if curl -sk -o /dev/null -w '%{http_code}' "https://localhost.emobix.co.uk:8443/api/plan?length=1" | grep -q 200; then
		break
	fi
	sleep 5
done

# The suite's nginx uses its own certificate: save it, so the runner can trust it (OPENID_SUITE_CA_FILE).
openssl s_client -connect localhost.emobix.co.uk:8443 -servername localhost.emobix.co.uk -showcerts </dev/null 2>/dev/null \
	| awk '/BEGIN CERTIFICATE/,/END CERTIFICATE/' > "$HERE/suite-certificate.pem"

cat <<HINT

The OpenID conformance suite ($VERSION) is at https://localhost.emobix.co.uk:8443

Set in the runner's .env:
  OPENID_SUITE_URL=https://localhost.emobix.co.uk:8443
  OPENID_SUITE_CA_FILE=$HERE/suite-certificate.pem
HINT
