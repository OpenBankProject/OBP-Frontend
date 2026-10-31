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
# Build the obp-cohort Docker image locally.
# PUBLIC_* env vars are read at container runtime (see Dockerfile_cohort):
# set them on `docker run`, as in the hint at the end.

set -euo pipefail

cd "$(dirname "$0")"

IMAGE="${IMAGE:-obp-cohort:local}"

docker build . \
  -f Dockerfile_cohort \
  --build-arg ORIGIN="${ORIGIN:-http://localhost:3000}" \
  --tag "$IMAGE"

cat <<EOF

Built $IMAGE

Run it with the runtime env vars the app needs:

  docker run --rm -p 3000:3000 \\
    -e PUBLIC_OBP_BASE_URL="https://apisandbox.openbankproject.com" \\
    -e ORIGIN="http://localhost:3000" \\
    $IMAGE
EOF
