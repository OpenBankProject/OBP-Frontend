#!/bin/bash
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
