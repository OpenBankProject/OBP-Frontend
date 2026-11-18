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
# Build the obp-conformator-runner Docker image locally. Its settings are read at runtime (see
# apps/conformator-runner/.env.example): set them on `docker run`, as in the hint at the end.

set -euo pipefail

cd "$(dirname "$0")"

IMAGE="${IMAGE:-obp-conformator-runner:local}"

docker build . -f Dockerfile_conformator_runner --tag "$IMAGE"

cat <<HINT

Built $IMAGE

Run it with its settings, and the participants' secrets mounted at /credentials:

  docker run --rm \\
    -e OBP_BASE_URL="http://host.docker.internal:8080" \\
    -e OIDC_ISSUER="http://host.docker.internal:9000/obp-oidc" \\
    -e OBP_OAUTH_CLIENT_ID=... -e OBP_OAUTH_CLIENT_SECRET=... \\
    -v "\$PWD/apps/conformator-runner/credentials:/credentials:ro" \\
    $IMAGE
HINT
