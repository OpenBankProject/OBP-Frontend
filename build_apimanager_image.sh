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
# Build the api-manager-ii Docker image locally.
# PUBLIC_* env vars are read at container runtime (see Dockerfile_apimanager),
# so this script only passes the OAuth/build-time args. Set PUBLIC_OBP_BASE_URL
# and PUBLIC_OPEY_BASE_URL on `docker run` instead — see the hint at the end.

set -euo pipefail

cd "$(dirname "$0")"

IMAGE="${IMAGE:-api-manager-ii:local}"

docker build . \
  -f Dockerfile_apimanager \
  --build-arg OBP_OAUTH_CLIENT_ID="${OBP_OAUTH_CLIENT_ID:-}" \
  --build-arg OBP_OAUTH_CLIENT_SECRET="${OBP_OAUTH_CLIENT_SECRET:-}" \
  --build-arg APP_CALLBACK_URL="${APP_CALLBACK_URL:-http://localhost:3003/login/obp/callback}" \
  --build-arg ORIGIN="${ORIGIN:-http://localhost:3003}" \
  --tag "$IMAGE"

cat <<EOF

Built $IMAGE

Run it with the runtime env vars the app needs:

  docker run --rm -p 3003:3003 \\
    -e PUBLIC_OBP_BASE_URL="https://apisandbox.openbankproject.com" \\
    -e PUBLIC_OPEY_BASE_URL="http://host.docker.internal:5000" \\
    -e OBP_OAUTH_CLIENT_ID="..." \\
    -e OBP_OAUTH_CLIENT_SECRET="..." \\
    -e APP_CALLBACK_URL="http://localhost:3003/login/obp/callback" \\
    -e ORIGIN="http://localhost:3003" \\
    $IMAGE
EOF
